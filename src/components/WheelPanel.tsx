'use client';

import { useEffect, useState } from 'react';
import { getBackend } from '@/lib/backend';
import { useWheel } from '@/lib/hooks';
import { sfx } from '@/lib/sfx';
import type { GameState, Player } from '@/lib/types';
import { MAX_SPINS, SEGMENTS } from '@/lib/wheel';
import { PrizeReveal } from './PrizeReveal';
import { Wheel } from './Wheel';

/**
 * The prize wheel, shared by the Stage and the winner's phone. The database
 * decides each spin: the first lands on "Better luck next time", which offers
 * one more spin, and the second lands on the voucher.
 */
export function WheelPanel({
  game,
  players,
  canSpin,
  viewerIsWinner,
  big,
}: {
  game: GameState;
  players: Player[];
  canSpin: boolean;
  viewerIsWinner: boolean;
  big?: boolean;
}) {
  const { spin, fresh } = useWheel();
  const [local, setLocal] = useState<{ segment: number; attempt: number } | null>(null);
  const [showPrize, setShowPrize] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After a reset, forget the local spin.
  useEffect(() => {
    if (!spin) {
      setLocal(null);
      setShowPrize(false);
    }
  }, [spin]);

  const latest = spin && (!local || spin.attempt >= local.attempt) ? { segment: spin.segment, attempt: spin.attempt } : local;
  const segment = latest?.segment ?? null;
  const attempt = latest?.attempt ?? 0;
  const seed = segment === null ? null : `${segment}-${attempt}-${game.winnerId}`;
  const animate = fresh || !!local;
  const missed = segment !== null && SEGMENTS[segment]?.kind === 'miss';
  const won = segment !== null && SEGMENTS[segment]?.kind === 'gift';
  const winner = players.find(p => p.id === game.winnerId);
  const winnerName = winner?.displayName ?? 'The winner';
  const canSpinNow = canSpin && !!game.winnerId && !busy && !spinning && (segment === null || (missed && attempt < MAX_SPINS));

  // Any new spin (from this device or another) plays its animation before buttons come back.
  useEffect(() => {
    if (seed && animate) setSpinning(true);
  }, [seed, animate]);

  const doSpin = async () => {
    sfx.unlock();
    setShowPrize(false);
    setBusy(true);
    setError(null);
    const res = await getBackend().spin();
    setBusy(false);
    if (res.error) setError(res.error);
    else if (typeof res.segment === 'number') setLocal({ segment: res.segment, attempt: attempt + 1 });
  };

  let heading = viewerIsWinner ? 'You won! Spin for your prize' : `${winnerName} is spinning the wheel`;
  if (missed && attempt < MAX_SPINS && !spinning) heading = viewerIsWinner ? 'One more try!' : `One more spin for ${winnerName}!`;
  if (won && !spinning) heading = viewerIsWinner ? 'Congratulations!' : `${winnerName} wins!`;

  return (
    <section className="card" style={{ justifyItems: 'center', textAlign: 'center', gap: 18 }}>
      <p className="eyebrow">The finale</p>
      <h2 style={big ? { fontSize: 'clamp(2rem, 5vw, 3.4rem)' } : undefined}>
        {big && winner ? `${winner.avatar} ` : ''}
        {heading}
      </h2>
      <p className="muted">Three mystery gifts. Two heartbreaks.</p>
      <Wheel
        segment={segment}
        seed={seed}
        animate={animate}
        onDone={() => {
          setSpinning(false);
          setShowPrize(true);
        }}
      />
      {canSpinNow && (
        <button type="button" className="big" onClick={doSpin}>
          {segment === null ? (viewerIsWinner ? 'Spin the wheel' : `Spin for ${winnerName}`) : viewerIsWinner ? 'Spin again!' : `Spin again for ${winnerName}`}
        </button>
      )}
      {busy && <p className="muted">Spinning…</p>}
      {segment !== null && !spinning && !showPrize && (
        <button type="button" className="ghost" onClick={() => setShowPrize(true)}>
          See the result
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {showPrize && segment !== null && (
        <PrizeReveal
          segment={segment}
          winnerName={winnerName}
          isWinner={viewerIsWinner}
          spinAgain={missed && attempt < MAX_SPINS}
          onSpinAgain={canSpin ? doSpin : undefined}
          onClose={() => setShowPrize(false)}
        />
      )}
    </section>
  );
}
