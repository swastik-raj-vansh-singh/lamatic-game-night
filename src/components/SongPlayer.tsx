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

type Status = 'loading' | 'idle' | 'playing' | 'paused' | 'ended' | 'error' | 'nosource' | 'notimed';

/* Minimal typing for the YouTube IFrame API we use. */
export type YTPlayer = {
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
export function loadYouTube(): Promise<YTNamespace> {
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

/** One audio source (file or YouTube) with play/pause/seek/time, used by the stage player and the timing tool. */
export function useMediaSource(source: string, box: React.RefObject<HTMLDivElement | null>, startHint = 0) {
  const src = source.trim();
  const ytId = src ? youtubeId(src) : null;
  const audio = useRef<HTMLAudioElement | null>(null);
  const yt = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const pendingPlay = useRef(false);

  useEffect(() => {
    setReady(false);
    setFailed(false);
    pendingPlay.current = false;
    if (!src) return;
    if (!ytId) {
      const a = new Audio(src);
      a.preload = 'auto';
      audio.current = a;
      const onReady = () => setReady(true);
      const onErr = () => setFailed(true);
      a.addEventListener('canplay', onReady);
      a.addEventListener('loadedmetadata', onReady);
      a.addEventListener('error', onErr);
      return () => {
        a.pause();
        a.removeEventListener('canplay', onReady);
        a.removeEventListener('loadedmetadata', onReady);
        a.removeEventListener('error', onErr);
        audio.current = null;
      };
    }
    let cancelled = false;
    let player: YTPlayer | null = null;
    loadYouTube().then(YT => {
      if (cancelled || !box.current) return;
      const el = document.createElement('div');
      box.current.innerHTML = '';
      box.current.appendChild(el);
      player = new YT.Player(el, {
        width: 240,
        height: 135,
        videoId: ytId,
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, start: Math.floor(startHint) },
        events: {
          onReady: () => {
            yt.current = player;
            setReady(true);
            if (pendingPlay.current) {
              pendingPlay.current = false;
              player?.playVideo();
            }
          },
          onError: () => setFailed(true),
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        player?.destroy();
      } catch {
        /* already gone */
      }
      yt.current = null;
    };
    // startHint only matters when the player is first created
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, ytId, box]);

  const api = {
    isYouTube: !!ytId,
    ready,
    failed,
    now: () => (ytId ? yt.current?.getCurrentTime?.() ?? 0 : audio.current?.currentTime ?? 0),
    seek: (t: number) => {
      if (ytId) yt.current?.seekTo?.(Math.max(0, t), true);
      else if (audio.current) audio.current.currentTime = Math.max(0, t);
    },
    play: () => {
      if (ytId) {
        if (yt.current) yt.current.playVideo();
        else pendingPlay.current = true;
        return;
      }
      audio.current?.play().catch(() => setFailed(true));
    },
    pause: () => {
      pendingPlay.current = false;
      if (ytId) yt.current?.pauseVideo?.();
      else audio.current?.pause();
    },
  };
  return api;
}

const fmt = (t: number) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;

/**
 * Plays a clip of a song from `start` and stops itself at `stop`, right before
 * the line players have to sing. Works with an audio file URL or a YouTube link.
 */
export const SongPlayer = forwardRef<SongPlayerHandle, { song: Song | null }>(function SongPlayer({ song }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const media = useMediaSource(song?.source ?? '', box, song?.start ?? 0);
  const raf = useRef(0);
  const endAt = useRef(0);
  const startedAt = useRef(0);
  const [status, setStatus] = useState<Status>('idle');
  const statusRef = useRef<Status>('idle');
  const [time, setTime] = useState(0);
  const mediaRef = useRef(media);
  mediaRef.current = media;

  const set = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    if (!song?.source.trim()) set('nosource');
    else if (!(song.stop > song.start)) set('notimed');
    else set(media.isYouTube ? 'loading' : 'idle');
    setTime(song?.start ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.round, song?.source, song?.start, song?.stop]);

  useEffect(() => {
    if (media.ready && statusRef.current === 'loading') set('idle');
  }, [media.ready]);
  useEffect(() => {
    if (media.failed) set('error');
  }, [media.failed]);

  const loop = useCallback(() => {
    const t = mediaRef.current.now();
    setTime(t);
    const warm = performance.now() - startedAt.current > 400;
    if (warm && endAt.current && t >= endAt.current - 0.03) {
      mediaRef.current.pause();
      set('ended');
      return;
    }
    raf.current = requestAnimationFrame(loop);
  }, []);

  const begin = useCallback(
    (from: number | null, until: number) => {
      if (!song || !song.source.trim()) {
        set('nosource');
        return;
      }
      if (!(song.stop > song.start)) {
        set('notimed');
        return;
      }
      if (from !== null) mediaRef.current.seek(from);
      endAt.current = until;
      startedAt.current = performance.now();
      mediaRef.current.play();
      set('playing');
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(loop);
    },
    [song, loop],
  );

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useImperativeHandle(
    ref,
    () => ({
      play() {
        if (!song) return;
        const t = mediaRef.current.now();
        const st = statusRef.current;
        const fresh = st !== 'paused' || t < song.start - 0.2 || t >= song.stop - 0.05;
        begin(fresh ? song.start : null, song.stop);
      },
      pause() {
        if (statusRef.current !== 'playing') return;
        cancelAnimationFrame(raf.current);
        mediaRef.current.pause();
        set('paused');
      },
      stop() {
        cancelAnimationFrame(raf.current);
        mediaRef.current.pause();
        if (song) {
          mediaRef.current.seek(song.start);
          setTime(song.start);
        }
        set(song && !(song.stop > song.start) ? 'notimed' : 'idle');
      },
      restart() {
        if (song) begin(song.start, song.stop);
      },
      playAnswer() {
        if (song) begin(song.stop, song.stop + ANSWER_SECONDS);
      },
    }),
    [song, begin],
  );

  const clipLen = song ? Math.max(0.1, song.stop - song.start) : 1;
  const into = song ? Math.min(clipLen, Math.max(0, time - song.start)) : 0;
  const label: Record<Status, string> = {
    loading: 'Loading YouTube…',
    idle: 'Ready',
    playing: 'Playing',
    paused: 'Paused',
    ended: 'Stopped before the line',
    error: 'Could not play this song. Check its link in Answer sheet → Songs.',
    nosource: 'No song set for this round. Add one in Answer sheet → Songs.',
    notimed: 'Stop time not set. Open Answer sheet → Songs → Set timing.',
  };

  return (
    <div className="player-card" aria-live="polite">
      {media.isYouTube && <div className="yt-box" ref={box} />}
      <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        <span className="eyebrow">Song clip</span>
        <span style={{ fontWeight: 700, color: status === 'error' || status === 'nosource' || status === 'notimed' ? 'var(--coral)' : undefined }}>
          {label[status]}
        </span>
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
