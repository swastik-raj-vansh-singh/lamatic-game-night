'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Song } from '@/lib/types';

export type SongPlayerHandle = {
  play(): void;
  pause(): void;
  stop(): void;
  restart(): void;
  playAnswer(): void;
};

type Status = 'idle' | 'playing' | 'paused' | 'ended' | 'error' | 'nosource';

/* Minimal typing for the YouTube IFrame API we use. */
type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  destroy(): void;
};
type YTNamespace = { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer };
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** How long "Play the real line" keeps playing after the stop point. */
const ANSWER_SECONDS = 8;

export function youtubeId(src: string): string | null {
  const m = src.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

let ytLoader: Promise<YTNamespace> | null = null;
function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytLoader) {
    ytLoader = new Promise(resolve => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        if (window.YT) resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    });
  }
  return ytLoader;
}

const fmt = (t: number) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;

/**
 * Plays a clip of a song from `start` and stops itself at `stop`, right before
 * the line players have to sing. Works with an audio file URL or a YouTube link.
 */
export const SongPlayer = forwardRef<SongPlayerHandle, { song: Song | null; onPlay?: () => void }>(function SongPlayer({ song, onPlay }, ref) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const yt = useRef<YTPlayer | null>(null);
  const ytBox = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const endAt = useRef(0);
  const startedAt = useRef(0);
  const [status, setStatus] = useState<Status>('idle');
  const statusRef = useRef<Status>('idle');
  const [time, setTime] = useState(0);
  const src = song?.source?.trim() ?? '';
  const ytId = src ? youtubeId(src) : null;

  const set = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  const now = useCallback(() => (ytId ? yt.current?.getCurrentTime?.() ?? 0 : audio.current?.currentTime ?? 0), [ytId]);
  const seek = useCallback(
    (t: number) => {
      if (ytId) yt.current?.seekTo?.(t, true);
      else if (audio.current) audio.current.currentTime = t;
    },
    [ytId],
  );
  const rawPause = useCallback(() => {
    cancelAnimationFrame(raf.current);
    if (ytId) yt.current?.pauseVideo?.();
    else audio.current?.pause();
  }, [ytId]);
  const rawPlay = useCallback(() => {
    if (ytId) {
      yt.current?.playVideo?.();
      return;
    }
    audio.current?.play().catch(() => set('error'));
  }, [ytId]);

  const loop = useCallback(() => {
    const t = now();
    setTime(t);
    const warm = performance.now() - startedAt.current > 350;
    if (warm && endAt.current && t >= endAt.current - 0.03) {
      rawPause();
      set('ended');
      return;
    }
    raf.current = requestAnimationFrame(loop);
  }, [now, rawPause]);

  // Audio file source
  useEffect(() => {
    rawPause();
    if (!src) {
      set('nosource');
      return;
    }
    if (ytId) return;
    const a = new Audio(src);
    a.preload = 'auto';
    audio.current = a;
    const onErr = () => set('error');
    const onEnded = () => set('ended');
    a.addEventListener('error', onErr);
    a.addEventListener('ended', onEnded);
    set('idle');
    setTime(song?.start ?? 0);
    return () => {
      a.pause();
      a.removeEventListener('error', onErr);
      a.removeEventListener('ended', onEnded);
      audio.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, ytId, song?.round]);

  // YouTube source
  useEffect(() => {
    if (!ytId) return;
    let cancelled = false;
    let player: YTPlayer | null = null;
    set('idle');
    loadYouTube().then(YT => {
      if (cancelled || !ytBox.current) return;
      const el = document.createElement('div');
      ytBox.current.innerHTML = '';
      ytBox.current.appendChild(el);
      player = new YT.Player(el, {
        width: 240,
        height: 135,
        videoId: ytId,
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, start: Math.floor(song?.start ?? 0) },
        events: {
          onReady: () => {
            yt.current = player;
          },
          onError: () => set('error'),
        },
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf.current);
      try {
        player?.destroy();
      } catch {
        /* already gone */
      }
      yt.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytId]);

  const begin = useCallback(
    (from: number | null, until: number) => {
      if (!song || !src) {
        set('nosource');
        return;
      }
      if (from !== null) seek(from);
      endAt.current = until;
      startedAt.current = performance.now();
      rawPlay();
      set('playing');
      onPlay?.();
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(loop);
    },
    [song, src, seek, rawPlay, loop, onPlay],
  );

  useImperativeHandle(
    ref,
    () => ({
      play() {
        if (!song) return;
        const t = now();
        const st = statusRef.current;
        const fresh = st === 'idle' || st === 'ended' || st === 'nosource' || t < song.start - 0.2 || t >= song.stop - 0.05;
        begin(fresh ? song.start : null, song.stop);
      },
      pause() {
        if (statusRef.current !== 'playing') return;
        rawPause();
        set('paused');
      },
      stop() {
        rawPause();
        if (song) {
          seek(song.start);
          setTime(song.start);
        }
        set('idle');
      },
      restart() {
        if (song) begin(song.start, song.stop);
      },
      playAnswer() {
        if (song) begin(song.stop, song.stop + ANSWER_SECONDS);
      },
    }),
    [song, now, begin, rawPause, seek],
  );

  const clipLen = song ? Math.max(0.1, song.stop - song.start) : 1;
  const into = song ? Math.min(clipLen, Math.max(0, time - song.start)) : 0;
  const label: Record<Status, string> = {
    idle: 'Ready',
    playing: 'Playing',
    paused: 'Paused',
    ended: 'Stopped before the line',
    error: 'Could not play this audio. Check the link in the Songs tab.',
    nosource: 'No audio set for this round. Add one in the host console.',
  };

  return (
    <div className="player-card" aria-live="polite">
      {ytId && <div className="yt-box" ref={ytBox} />}
      <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        <span className="eyebrow">Song clip</span>
        <span style={{ fontWeight: 700 }}>{label[status]}</span>
        <span className="row" style={{ gap: 8 }}>
          <span className="meter" aria-hidden="true">
            <i style={{ width: `${(into / clipLen) * 100}%` }} />
          </span>
          <span className="num muted" style={{ fontSize: '0.85rem' }}>
            {fmt(into)} / {fmt(clipLen)}
          </span>
        </span>
      </div>
    </div>
  );
});
