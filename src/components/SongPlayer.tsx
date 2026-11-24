'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Song } from '@/lib/types';

/** Where a play command started and where it will stop (null: plays until paused). */
export type PlayRange = { from: number; until: number | null };

export type SongPlayerHandle = {
  play(): PlayRange | null;
  pause(): void;
  stop(): void;
  restart(): PlayRange | null;
  playAnswer(): PlayRange | null;
  now(): number;
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

/** Plain-language reason for a YouTube player error code. */
export function youtubeError(code: unknown): string {
  if (code === 101 || code === 150 || code === 152) return 'The owner blocks this video outside YouTube. Use another upload of the song.';
  if (code === 100) return 'This video was removed or is private.';
  if (code === 2) return 'This YouTube link is not valid.';
  return 'This video could not be played.';
}

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
  const [failed, setFailed] = useState<string | null>(null);
  const pendingPlay = useRef(false);

  useEffect(() => {
    setReady(false);
    setFailed(null);
    pendingPlay.current = false;
    if (!src) return;
    if (!ytId) {
      const a = new Audio(src);
      a.preload = 'auto';
      audio.current = a;
      const onReady = () => setReady(true);
      const onErr = () => setFailed('This audio file could not be loaded. Check the link.');
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
          onError: (e: { data?: unknown }) => setFailed(youtubeError(e?.data)),
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
      audio.current?.play().catch(() => setFailed('The browser blocked playback. Click anywhere on the page, then try again.'));
    },
    pause: () => {
      pendingPlay.current = false;
      if (ytId) yt.current?.pauseVideo?.();
      else audio.current?.pause();
    },
    /** Call from a tap so the browser allows sound later without another tap. */
    unlock: () => {
      if (ytId) {
        const p = yt.current;
        if (p) {
          p.playVideo();
          setTimeout(() => p.pauseVideo(), 120);
        }
        return;
      }
      const a = audio.current;
      if (!a) return;
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.muted = false;
        })
        .catch(() => {
          a.muted = false;
        });
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
    (from: number | null, until: number | null): PlayRange | null => {
      if (!song || !song.source.trim()) {
        set('nosource');
        return null;
      }
      if (mediaRef.current.failed) {
        set('error');
        return null;
      }
      const start = from ?? mediaRef.current.now();
      if (from !== null) mediaRef.current.seek(from);
      endAt.current = until ?? 0;
      startedAt.current = performance.now();
      mediaRef.current.play();
      set('playing');
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(loop);
      return { from: Math.round(start * 100) / 100, until };
    },
    [song, loop],
  );

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useImperativeHandle(
    ref,
    () => ({
      play() {
        if (!song) return null;
        const timed = song.stop > song.start;
        const t = mediaRef.current.now();
        const st = statusRef.current;
        const fresh = st !== 'paused' || t < song.start - 0.2 || (timed && t >= song.stop - 0.05);
        return begin(fresh ? song.start : null, timed ? song.stop : null);
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
        return song ? begin(song.start, song.stop > song.start ? song.stop : null) : null;
      },
      playAnswer() {
        return song && song.stop > song.start ? begin(song.stop, song.stop + ANSWER_SECONDS) : null;
      },
      now() {
        return mediaRef.current.now();
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
    error: `${media.failed ?? 'Could not play this song.'} (Answer sheet → Songs)`,
    nosource: 'No song set for this round. Add one in Answer sheet → Songs.',
    notimed: 'No stop time set: it will play until you press Pause. Set one in Answer sheet → Songs.',
  };

  return (
    <div className="player-card" aria-live="polite">
      {media.isYouTube && <div className="yt-box" ref={box} />}
      <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        <span className="eyebrow">Song clip</span>
        <span style={{ fontWeight: 700, color: status === 'error' || status === 'nosource' ? 'var(--coral)' : status === 'notimed' ? 'var(--bulb)' : undefined }}>
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

/**
 * Tries a song in this browser: loads it (muted) and reports whether it really
 * starts playing. Used by "Check all songs" on the answer sheet.
 */
export async function checkSource(src: string, mount: HTMLElement): Promise<{ ok: boolean; reason?: string }> {
  const source = src.trim();
  if (!source) return { ok: false, reason: 'No link' };
  const id = youtubeId(source);
  if (!id) {
    return new Promise(resolve => {
      const a = new Audio(source);
      const t = setTimeout(() => resolve({ ok: false, reason: 'Audio did not load' }), 10000);
      a.addEventListener('canplay', () => {
        clearTimeout(t);
        resolve({ ok: true });
      });
      a.addEventListener('error', () => {
        clearTimeout(t);
        resolve({ ok: false, reason: 'Audio file not found' });
      });
    });
  }
  const YT = await loadYouTube();
  return new Promise(resolve => {
    const el = document.createElement('div');
    mount.innerHTML = '';
    mount.appendChild(el);
    let done = false;
    let player: (YTPlayer & { mute?: () => void; getPlayerState?: () => number }) | null = null;
    const finish = (r: { ok: boolean; reason?: string }) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        player?.destroy();
      } catch {
        /* already gone */
      }
      resolve(r);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: 'Did not start within 12 seconds' }), 12000);
    player = new YT.Player(el, {
      width: 200,
      height: 113,
      videoId: id,
      playerVars: { playsinline: 1, mute: 1, controls: 0 },
      events: {
        onReady: () => {
          player?.mute?.();
          player?.playVideo();
        },
        onStateChange: (e: { data?: number }) => {
          if (e?.data === 1) finish({ ok: true });
        },
        onError: (e: { data?: unknown }) => finish({ ok: false, reason: youtubeError(e?.data) }),
      },
    }) as YTPlayer;
  });
}
