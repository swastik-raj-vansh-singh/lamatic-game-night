'use client';

import { useEffect, useRef, useState } from 'react';
import { sfx } from '@/lib/sfx';
import { SEGMENTS } from '@/lib/wheel';

async function burst() {
  const confetti = (await import('canvas-confetti')).default;
  const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const colors = [css('--bulb'), css('--coral'), css('--teal'), css('--ink')];
  confetti({ particleCount: 170, spread: 85, origin: { y: 0.6 }, colors, zIndex: 70, disableForReducedMotion: true });
  setTimeout(() => confetti({ particleCount: 90, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors, zIndex: 70, disableForReducedMotion: true }), 260);
  setTimeout(() => confetti({ particleCount: 90, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors, zIndex: 70, disableForReducedMotion: true }), 420);
}

export async function celebrate() {
  try {
    await burst();
  } catch {
    /* confetti is decoration */
  }
}

export function PrizeReveal({ segment, winnerName, isWinner, onClose }: { segment: number; winnerName: string; isWinner: boolean; onClose: () => void }) {
  const s = SEGMENTS[segment];
  const isGift = s?.kind === 'gift';
  const [opened, setOpened] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const t = setTimeout(
      () => {
        setOpened(true);
        if (isGift) {
          sfx.fanfare();
          void celebrate();
        } else sfx.wah();
      },
      isGift ? 1500 : 500,
    );
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [isGift, onClose]);

  if (!s) return null;
  return (
    <div className="reveal" role="dialog" aria-modal="true" aria-labelledby="reveal-title" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`reveal-card${opened ? ' opened' : ''}`}>
        {isGift ? (
          <div className={`giftbox${opened ? ' open' : ' shaking'}`} aria-hidden="true">
            <div className="lid">
              <div className="bow" />
            </div>
            <div className="box" />
          </div>
        ) : (
          <svg width="120" height="110" viewBox="0 0 120 110" aria-hidden="true">
            <path d="M30 62a18 18 0 0 1 4-35 26 26 0 0 1 49 4 16 16 0 0 1 7 31Z" fill="var(--muted)" />
            <path d="M38 76l-5 12M58 76l-5 12M78 76l-5 12M48 92l-4 10M68 92l-4 10" stroke="var(--teal)" strokeWidth="4" strokeLinecap="round" />
          </svg>
        )}
        <p className="eyebrow">{isGift ? (opened ? `Gift ${s.num} unlocked` : `Opening Gift ${s.num}…`) : 'Oh no'}</p>
        <h2 id="reveal-title" className="reveal-title prize-line">
          {isGift ? s.prize : 'Better luck next time'}
        </h2>
        <p className="prize-line">
          {isGift
            ? isWinner
              ? 'The host will send your voucher code to you privately.'
              : `${winnerName} wins a ${s.prize}!`
            : isWinner
              ? 'The wheel has spoken. You still won game night.'
              : `So close, ${winnerName}. Still the champion.`}
        </p>
        <button ref={closeRef} type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
