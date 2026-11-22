'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PrizeReveal } from '@/components/PrizeReveal';
import { Wheel } from '@/components/Wheel';
import { BuzzList, Game1View, LeaderboardView, LobbyView, RoundHeader, RoundStatusBoard, TeamsView } from '@/components/views';
import { Loading, TopBar } from '@/components/ui';
import { getBackend } from '@/lib/backend';
import { TEAM_LABEL, currentAttempt, sortBuzzes, triedTeams } from '@/lib/game';
import { useBuzzes, useGameState, useGate, useWheel } from '@/lib/hooks';
import { sfx } from '@/lib/sfx';
import type { Buzz, GameState, Player } from '@/lib/types';

function BuzzerPad({ game, me, buzzes, players }: { game: GameState; me: Player; buzzes: Buzz[]; players: Player[] }) {
  const r = game.round;
  const team = game.teams[me.id];
  const openedAt = useRef<number | null>(null);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    openedAt.current = null;
    setNote(null);
  }, [r.key]);
  useEffect(() => {
    if ((r.status === 'open' || r.status === 'answering') && openedAt.current === null) openedAt.current = performance.now();
  }, [r.status, r.key]);

  const sorted = sortBuzzes(buzzes).filter(b => b.roundKey === r.key);
  const mine = sorted.find(b => b.playerId === me.id);
  const pos = mine ? sorted.indexOf(mine) + 1 : 0;
  const att = currentAttempt(r);
  const teamTried = !!team && triedTeams(r).has(team);
  const buzzWindow = r.status === 'open' || r.status === 'answering';
  const live = buzzWindow && !!team && !mine && !teamTried && !pending;

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
    else setNote(`You buzzed in ${(ms / 1000).toFixed(2)}s`);
  }, [live, r.key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== 'Enter') return;
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      e.preventDefault();
      void press();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  let label = 'BUZZ';
  let sub = 'Tap the button or press Space';
  if (!team) {
    label = 'WAIT';
    sub = "You're not on a team yet. Ask the host to shuffle again.";
  } else if (r.status === 'ready') {
    label = 'WAIT';
    sub = 'Buzzers open when the music starts.';
  } else if (mine) {
    label = `#${pos}`;
    sub = att?.playerId === me.id ? "You're up! Sing the next line now." : att?.team === team ? 'Your team is answering!' : pos === 1 ? 'You were first!' : 'You are in the queue.';
  } else if (teamTried && att?.team !== team) {
    label = 'DONE';
    sub = `${TEAM_LABEL[team]} already had its turn this round.`;
  } else if (att?.team === team) {
    label = 'GO!';
    sub = `${players.find(p => p.id === att.playerId)?.displayName ?? 'Your teammate'} is answering. Help them out!`;
  } else if (!buzzWindow) {
    label = 'DONE';
    sub = 'This round is over.';
  }

  return (
    <div className="buzzer-wrap">
      <button
        type="button"
        className={`buzzer${live ? ' live' : ''}${mine ? ' done' : ''}${pressed ? ' pressed' : ''}`}
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
        {note && mine ? note : sub}
      </p>
    </div>
  );
}

function WheelPhase({ game, me, players }: { game: GameState; me: Player; players: Player[] }) {
  const { spin, fresh } = useWheel();
  const [showPrize, setShowPrize] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isWinner = game.winnerId === me.id;
  const winnerName = players.find(p => p.id === game.winnerId)?.displayName ?? 'The winner';

  return (
    <section className="card" style={{ justifyItems: 'center', textAlign: 'center', gap: 18 }}>
      <p className="eyebrow">The finale</p>
      <h2>{isWinner ? 'You won! Spin for your prize' : `${winnerName} is spinning the wheel`}</h2>
      <p className="muted">Three mystery gifts. Two heartbreaks. One spin.</p>
      <Wheel segment={spin?.segment ?? null} seed={spin?.spunAt ?? null} animate={fresh} onDone={() => setShowPrize(true)} />
      {isWinner && !spin && (
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
          }}
        >
          {busy ? 'Spinning…' : 'Spin the wheel'}
        </button>
      )}
      {spin && !fresh && (
        <button type="button" className="ghost" onClick={() => setShowPrize(true)}>
          See the result
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {showPrize && spin && <PrizeReveal segment={spin.segment} winnerName={winnerName} isWinner={isWinner} onClose={() => setShowPrize(false)} />}
    </section>
  );
}

export default function PlayPage() {
  const { me, players, host, ready } = useGate({ needPlayer: true });
  const { game } = useGameState();
  const buzzes = useBuzzes(game?.phase === 'round' ? game.round.key : null);
  const lastStatus = useRef<string | null>(null);

  // Little sound cues as the round moves along.
  useEffect(() => {
    if (!game || game.phase !== 'round') return;
    const s = `${game.round.key}:${game.round.status}`;
    if (lastStatus.current && lastStatus.current !== s) {
      if (game.round.status === 'won') sfx.fanfare();
      else if (game.round.status === 'open' && game.round.attempts.some(a => a.result === 'wrong')) sfx.wrong();
      else if (game.round.status === 'failed') sfx.wrong();
    }
    lastStatus.current = s;
  }, [game]);

  if (!ready || !game) return <Loading />;
  if (!me) {
    return (
      <>
        <TopBar host={host} />
        <main className="shell narrow">
          <div className="card">
            <h2>You&apos;re signed in as the host</h2>
            <p className="muted">Open the Stage to run the game, or pick a name to play along.</p>
          </div>
        </main>
      </>
    );
  }

  const team = game.teams[me.id];

  return (
    <>
      <TopBar me={me} team={team} points={game.points[me.id] ?? 0} host={host} />
      <main className="shell">
        {game.phase === 'lobby' && <LobbyView players={players} meId={me.id} />}
        {game.phase === 'game1' && <Game1View game={game} />}
        {game.phase === 'teams' && <TeamsView game={game} players={players} meId={me.id} />}
        {game.phase === 'round' && (
          <>
            <RoundHeader game={game} />
            <RoundStatusBoard game={game} players={players} meId={me.id} />
            <BuzzerPad game={game} me={me} buzzes={buzzes} players={players} />
            <BuzzList game={game} players={players} buzzes={buzzes} limit={6} />
          </>
        )}
        {game.phase === 'leaderboard' && <LeaderboardView game={game} players={players} meId={me.id} />}
        {game.phase === 'wheel' && <WheelPhase game={game} me={me} players={players} />}
      </main>
    </>
  );
}
