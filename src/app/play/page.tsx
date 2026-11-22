'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PrizeReveal } from '@/components/PrizeReveal';
import { Wheel } from '@/components/Wheel';
import { BuzzList, FinalResults, Game1View, LiveBoard, LobbyView, RoundHeader, RoundStatusBoard } from '@/components/views';
import Link from 'next/link';
import { Loading, TopBar } from '@/components/ui';
import { getBackend } from '@/lib/backend';
import { currentAttempt, playersOnly, sortBuzzes } from '@/lib/game';
import { useBuzzes, useGameState, useGate, useWheel } from '@/lib/hooks';
import { sfx } from '@/lib/sfx';
import type { Buzz, GameState, Player } from '@/lib/types';

function BuzzerPad({ game, me, buzzes }: { game: GameState; me: Player; buzzes: Buzz[] }) {
  const r = game.round;
  const openedAt = useRef<number | null>(null);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);
  const [localBuzz, setLocalBuzz] = useState<string | null>(null);

  useEffect(() => {
    openedAt.current = null;
    setNote(null);
    setLocalBuzz(null);
  }, [r.key]);
  useEffect(() => {
    if ((r.status === 'open' || r.status === 'answering') && openedAt.current === null) openedAt.current = performance.now();
  }, [r.status, r.key]);

  const sorted = sortBuzzes(buzzes).filter(b => b.roundKey === r.key);
  const mine = sorted.find(b => b.playerId === me.id);
  const buzzed = !!mine || localBuzz === r.key;
  const pos = mine ? sorted.indexOf(mine) + 1 : 0;
  const att = currentAttempt(r);
  const myAttempt = r.attempts.find(a => a.playerId === me.id);
  const buzzWindow = r.status === 'open' || r.status === 'answering';
  const live = buzzWindow && !buzzed && !myAttempt && !pending;

  const press = useCallback(async () => {
    if (!live) return;
    setPending(true);
    setPressed(true);
    setTimeout(() => setPressed(false), 140);
    sfx.buzz();
    try {
      navigator.vibrate?.(70);
    } catch {
      /* not supported */
    }
    const ms = openedAt.current !== null ? performance.now() - openedAt.current : 0;
    const res = await getBackend().buzz(r.key, ms);
    setPending(false);
    if (res.error) setNote(res.error);
    else {
      setLocalBuzz(r.key);
      setNote(`You buzzed in ${(ms / 1000).toFixed(2)}s`);
    }
  }, [live, r.key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== 'Enter') return;
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName) && el.className.indexOf('buzzer') < 0) return;
      e.preventDefault();
      void press();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  let label = 'BUZZ';
  let sub = 'Tap the button or press Space';
  if (r.status === 'ready') {
    label = 'WAIT';
    sub = 'Buzzers open when the music starts.';
  } else if (att?.playerId === me.id) {
    label = 'SING!';
    sub = "You're up! Unmute and sing the next line.";
  } else if (myAttempt?.result === 'correct') {
    label = '★';
    sub = 'You got it!';
  } else if (myAttempt?.result === 'wrong') {
    label = 'OUT';
    sub = 'You had your turn this song.';
  } else if (buzzed) {
    label = pos ? `#${pos}` : '✓';
    sub = pos === 1 ? 'You were first!' : 'You are in the queue.';
  } else if (!buzzWindow) {
    label = 'DONE';
    sub = 'This song is over.';
  }

  return (
    <div className="buzzer-wrap">
      <button
        type="button"
        className={`buzzer${live ? ' live' : ''}${buzzed ? ' done' : ''}${pressed ? ' pressed' : ''}`}
        disabled={!live}
        onPointerDown={e => {
          e.preventDefault();
          void press();
        }}
        onClick={e => e.preventDefault()}
        aria-label={live ? 'Buzz in' : `Buzzer: ${sub}`}
      >
        {label}
      </button>
      <p className="buzz-note" aria-live="polite">
        {note && buzzed && !myAttempt ? note : sub}
      </p>
    </div>
  );
}

function WheelPhase({ game, me, players }: { game: GameState; me: Player; players: Player[] }) {
  const { spin, fresh } = useWheel();
  const [local, setLocal] = useState<{ segment: number } | null>(null);
  const [showPrize, setShowPrize] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isWinner = game.winnerId === me.id;
  const winner = players.find(p => p.id === game.winnerId);
  const segment = spin?.segment ?? local?.segment ?? null;
  const seed = segment === null ? null : `${segment}-${game.winnerId}`;

  return (
    <section className="card" style={{ justifyItems: 'center', textAlign: 'center', gap: 18 }}>
      <p className="eyebrow">The finale</p>
      <h2>{isWinner ? 'You won! Spin for your prize' : `${winner?.displayName ?? 'The winner'} is spinning the wheel`}</h2>
      <p className="muted">Three mystery gifts. Two heartbreaks. One spin.</p>
      <Wheel segment={segment} seed={seed} animate={fresh || !!local} onDone={() => setShowPrize(true)} />
      {isWinner && segment === null && (
        <button
          type="button"
          className="big"
          disabled={busy}
          onClick={async () => {
            sfx.unlock();
            setBusy(true);
            setError(null);
            const res = await getBackend().spin();
            setBusy(false);
            if (res.error) setError(res.error);
            else if (typeof res.segment === 'number') setLocal({ segment: res.segment });
          }}
        >
          {busy ? 'Spinning…' : 'Spin the wheel'}
        </button>
      )}
      {segment !== null && !fresh && !local && (
        <button type="button" className="ghost" onClick={() => setShowPrize(true)}>
          See the result
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {showPrize && segment !== null && <PrizeReveal segment={segment} winnerName={winner?.displayName ?? 'The winner'} isWinner={isWinner} onClose={() => setShowPrize(false)} />}
    </section>
  );
}

export default function PlayPage() {
  const { me, players, host, ready } = useGate({ needPlayer: true });
  const { game } = useGameState();
  const buzzes = useBuzzes(game?.phase === 'round' ? game.round.key : null);
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    if (!game || game.phase !== 'round') return;
    const s = `${game.round.key}:${game.round.status}:${game.round.attempts.length}`;
    if (lastStatus.current && lastStatus.current !== s) {
      if (game.round.status === 'won') sfx.fanfare();
      else if (game.round.attempts.some(a => a.result === 'wrong') && game.round.status !== 'answering') sfx.wrong();
    }
    lastStatus.current = s;
  }, [game]);

  if (!ready || !game) return <Loading />;
  if (host || !me) {
    return (
      <>
        <TopBar host={host} />
        <main className="shell narrow">
          <div className="card">
            <h2>You&apos;re the host</h2>
            <p className="muted">Hosts run the game and don&apos;t play, so you won&apos;t appear on anyone&apos;s screen. Share the Stage on Meet and keep the Answer sheet on your phone.</p>
            <div className="row">
              <Link className="btn" href="/stage">
                Open the Stage
              </Link>
              <Link className="btn ghost" href="/host">
                Open the Answer sheet
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }
  const visible = playersOnly(players, game);

  return (
    <>
      <TopBar me={me} points={game.points[me.id] ?? 0} host={host} />
      <main className="shell">
        {game.phase === 'lobby' && <LobbyView players={visible} meId={me.id} />}
        {game.phase === 'game1' && <Game1View game={game} players={visible} />}
        {game.phase === 'round' && (
          <>
            <RoundHeader game={game} />
            <RoundStatusBoard game={game} players={players} meId={me.id} />
            <BuzzerPad game={game} me={me} buzzes={buzzes} />
            <BuzzList game={game} players={players} buzzes={buzzes} limit={6} />
            <LiveBoard game={game} players={visible} meId={me.id} />
          </>
        )}
        {game.phase === 'leaderboard' && <FinalResults game={game} players={visible} meId={me.id} />}
        {game.phase === 'wheel' && <WheelPhase game={game} me={me} players={visible} />}
      </main>
    </>
  );
}
