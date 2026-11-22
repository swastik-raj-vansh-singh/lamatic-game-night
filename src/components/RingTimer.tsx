'use client';

import { useEffect, useRef } from 'react';
import { useCountdown } from '@/lib/hooks';
import { sfx } from '@/lib/sfx';

const C = 2 * Math.PI * 54;

/** 5-second answer clock. Restarts when `runKey` changes. */
export function RingTimer({ runKey, ms, onEnd, sound = true }: { runKey: string | null; ms: number; onEnd?: () => void; sound?: boolean }) {
  const left = useCountdown(runKey, ms, () => {
    if (sound) sfx.timeUp();
    onEnd?.();
  });
  const secs = Math.ceil(left / 1000);
  const last = useRef(secs);
  useEffect(() => {
    if (secs !== last.current && secs > 0 && secs < Math.ceil(ms / 1000) && sound) sfx.count();
    last.current = secs;
  }, [secs, ms, sound]);
  const done = !!runKey && left <= 0;
  return (
    <div className={`ring-timer${done ? ' done' : ''}`} role="timer" aria-live="off">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="track" cx="60" cy="60" r="54" fill="none" strokeWidth="10" />
        <circle
          className="ring"
          cx="60"
          cy="60"
          r="54"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - left / ms)}
        />
      </svg>
      <div className="ring-read">
        <b>{done ? 0 : secs}</b>
        <span>{done ? "time's up" : 'seconds'}</span>
      </div>
    </div>
  );
}
