'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrizeReveal, celebrate } from '@/components/PrizeReveal';
import { SongPlayer, type SongPlayerHandle } from '@/components/SongPlayer';
import { Wheel } from '@/components/Wheel';
import { BuzzList, Game1View, LeaderboardView, LobbyView, RoundHeader, RoundStatusBoard, TeamsView } from '@/components/views';
import { Bulbs, DemoBanner, Loading, SoundToggle } from '@/components/ui';
import { getBackend } from '@/lib/backend';
import { DEMO } from '@/lib/config';
import {
  assignTeams,
  closeRound,
  crownWinner,
  goToRound,
  initialState,
  judge,
  nextCandidate,
  openBuzzers,
  rankPlayers,
  rememberBoard,
  revealAnswer,
  roundWinner,
  setPhase,
  showLeaderboard,
  startNextAttempt,
  suggestTeamCount,
} from '@/lib/game';
import { useBuzzes, useGameState, useGate, useHostActions, useWheel } from '@/lib/hooks';
import { sfx } from '@/lib/sfx';
import type { Song } from '@/lib/types';

export default function StagePage() {
  const { user, players, ready } = useGate({ needHost: true });
  const { game, empty } = useGameState();
  const { apply, error } = useHostActions(game);
  const buzzes = useBuzzes(game?.phase === 'round' ? game.round.key : null);
  const { spin, fresh } = useWheel();
  const [songs, setSongs] = useState<Song[]>([]);
  const [showPrize, setShowPrize] = useState(false);
  const [origin, setOrigin] = useState('');
  const player = useRef<SongPlayerHandle>(null);

  const contestants = useMemo(() => players.filter(p => p.id !== user?.id), [players, user]);
  const song = songs.find(s => s.round === (game?.round.index ?? 0) + 1) ?? null;
  const backend = getBackend();

  useEffect(() => setOrigin(window.location.host), []);

  useEffect(() => {
    if (!ready) return;
    const load = () => backend.fetchSongs().then(setSongs);
    void load();
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [ready, backend]);

  // First run: create the game state row.
  useEffect(() => {
    if (ready && empty) void backend.writeState(initialState());
  }, [ready, empty, backend]);

  // Buzzer engine: first buzz (by server time) gets the turn. A short grace
  // period lets near-simultaneous buzzes land before we pick.
  useEffect(() => {
    if (!game || game.phase !== 'round' || game.round.status !== 'open') return;
    if (!nextCandidate(game, buzzes)) return;
    const key = game.round.key;
    const t = setTimeout(async () => {
      const latest = await backend.fetchBuzzes(key);
      await apply(s => (s.round.key === key ? startNextAttempt(s, latest) : null));
    }, 350);
    return () => clearTimeout(t);
  }, [game, buzzes, apply, backend]);

  // Someone buzzed: stop the music.
  const answeringSeq = game?.round.status === 'answering' ? game.round.attempts.length : 0;
  useEffect(() => {
    if (answeringSeq > 0) {
      player.current?.pause();
      sfx.buzz();
    }
  }, [answeringSeq]);

  // Keep a record of every finished round.
  const roundDone = game && (game.round.status === 'won' || game.round.status === 'failed') ? `${game.round.key}:${game.round.status}` : null;
  useEffect(() => {
    if (!roundDone || !game) return;
    const w = roundWinner(game.round);
    if (game.round.status === 'won') void celebrate();
    void backend.logRound({
      round: game.round.index + 1,
      roundKey: game.round.key,
      outcome: game.round.status === 'won' ? 'won' : 'failed',
      team: w?.team ?? null,
      answeredBy: w?.playerId ?? null,
      points: game.round.awarded?.points ?? {},
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundDone]);

  // Demo mode: test players buzz on their own so you can try the flow alone.
  const botWindow = game?.phase === 'round' && (game.round.status === 'open' || game.round.status === 'answering') ? game.round.key : null;
  useEffect(() => {
    if (!DEMO || !botWindow || !backend.botBuzz || !game) return;
    const bots = players.filter(p => p.isBot && game.teams[p.id]);
    const timers = bots.map(p =>
      Math.random() < 0.6 ? setTimeout(() => void backend.botBuzz?.(botWindow, p.id, 0), 1200 + Math.random() * 4000) : null,
    );
    return () => timers.forEach(t => t && clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botWindow]);

  if (!ready || !game) return <Loading label="Opening the stage…" />;

  const r = game.round;
  const isLast = r.index >= game.totalRounds - 1;
  const winner = players.find(p => p.id === game.winnerId);
  const top = rankPlayers(contestants, game.points)[0];

  const play = async () => {
    sfx.unlock();
    if (game.phase === 'round' && r.status === 'ready') await apply(openBuzzers);
    player.current?.play();
  };

  return (
    <div className="stage-page">
      <div>
        <DemoBanner />
        <header className="topbar">
          <div className="topbar-in">
            <span className="brand">
              Lamatic <span>Game Night</span>
            </span>
            <div className="row">
              <span className="chip">Stage · share this tab on Meet</span>
              <SoundToggle />
              <Link className="btn ghost small" href="/host" target="_blank">
                Host console
              </Link>
            </div>
          </div>
        </header>
      </div>

      <main className="stage-main">
        {game.phase === 'lobby' && (
          <>
            <div className="marquee" style={{ width: '100%' }}>
              <Bulbs count={24} />
              <p className="eyebrow">Join now</p>
              <h1 style={{ fontSize: 'clamp(2.6rem, 8vw, 5.4rem)' }}>Game Night</h1>
              <p className="join-url">{origin}</p>
              <p className="muted">Sign in with your work email, pick a name, and you&apos;ll pop up below.</p>
              <Bulbs count={24} />
            </div>
            <LobbyView players={contestants} big />
          </>
        )}
        {game.phase === 'game1' && <Game1View game={game} />}
        {game.phase === 'teams' && <TeamsView game={game} players={contestants} />}
        {game.phase === 'round' && (
          <div className="stage-round">
            <div style={{ display: 'grid', gap: 16 }}>
              <RoundHeader game={game} />
              <RoundStatusBoard game={game} players={players} />
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <SongPlayer ref={player} song={song} />
              <BuzzList game={game} players={players} buzzes={buzzes} limit={10} />
            </div>
          </div>
        )}
        {game.phase === 'leaderboard' && <LeaderboardView game={game} players={contestants} big />}
        {game.phase === 'wheel' && (
          <section className="card" style={{ justifyItems: 'center', textAlign: 'center', gap: 18 }}>
            <p className="eyebrow">The finale</p>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.4rem)' }}>{winner ? `${winner.avatar} ${winner.displayName}` : 'Our champion'}</h2>
            <p className="muted">{spin ? 'The wheel has spoken.' : 'Champion, spin the wheel on your screen!'}</p>
            <Wheel segment={spin?.segment ?? null} seed={spin?.spunAt ?? null} animate={fresh} onDone={() => setShowPrize(true)} />
            {spin && !fresh && (
              <button type="button" className="ghost" onClick={() => setShowPrize(true)}>
                Show the prize
              </button>
            )}
            {showPrize && spin && <PrizeReveal segment={spin.segment} winnerName={winner?.displayName ?? 'Our champion'} isWinner={false} onClose={() => setShowPrize(false)} />}
          </section>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </main>

      <nav className="controlbar" aria-label="Host controls">
        <div className="controlbar-in">
          <div className="group">
            {game.phase === 'lobby' && (
              <button type="button" className="big" onClick={() => apply(s => setPhase(s, 'game1'))}>
                Start Game 1 →
              </button>
            )}
            {game.phase === 'game1' && (
              <button
                type="button"
                className="big"
                onClick={() => apply(s => assignTeams(s, contestants, s.teamCount || suggestTeamCount(contestants.length)))}
                disabled={contestants.length < 1}
              >
                Shuffle teams →
              </button>
            )}
            {game.phase === 'teams' && (
              <>
                <button type="button" className="ghost" onClick={() => apply(s => assignTeams(s, contestants, s.teamCount))}>
                  Shuffle again
                </button>
                <button type="button" className="big" onClick={() => apply(s => goToRound(rememberBoard(s), 0))}>
                  Start Round 1 →
                </button>
              </>
            )}
            {game.phase === 'round' && (
              <>
                {r.status === 'ready' && (
                  <button type="button" className="big" onClick={play}>
                    ▶ Play clip
                  </button>
                )}
                {(r.status === 'open' || r.status === 'answering') && (
                  <>
                    <button type="button" className="teal" onClick={play}>
                      ▶ Play
                    </button>
                    <button type="button" className="ghost" onClick={() => player.current?.pause()}>
                      ❚❚ Pause
                    </button>
                    <button type="button" className="ghost" onClick={() => player.current?.stop()}>
                      ■ Stop
                    </button>
                    <button type="button" className="ghost" onClick={() => player.current?.restart()}>
                      ↺ Restart clip
                    </button>
                  </>
                )}
                {r.status === 'answering' && (
                  <>
                    <button
                      type="button"
                      className="teal big"
                      onClick={() => {
                        sfx.ding();
                        void apply(s => judge(s, true, buzzes));
                      }}
                    >
                      ✓ Correct
                    </button>
                    <button
                      type="button"
                      className="coral big"
                      onClick={() => {
                        sfx.wrong();
                        void apply(s => judge(s, false, buzzes));
                      }}
                    >
                      ✗ Wrong
                    </button>
                  </>
                )}
                {r.status === 'open' && (
                  <button type="button" className="ghost" onClick={() => apply(closeRound)}>
                    Nobody knows it
                  </button>
                )}
                {(r.status === 'won' || r.status === 'failed') && (
                  <button type="button" className="big" onClick={() => apply(s => revealAnswer(s, song ?? undefined))}>
                    Reveal the line
                  </button>
                )}
                {r.status === 'revealed' && (
                  <>
                    <button type="button" className="ghost" onClick={() => player.current?.playAnswer()}>
                      ▶ Play the real line
                    </button>
                    <button type="button" className="big" onClick={() => apply(showLeaderboard)}>
                      {isLast ? 'Final leaderboard →' : 'Leaderboard →'}
                    </button>
                  </>
                )}
              </>
            )}
            {game.phase === 'leaderboard' &&
              (isLast && (r.status === 'revealed' || r.status === 'won' || r.status === 'failed') ? (
                <button type="button" className="big" disabled={!top} onClick={() => top && apply(s => crownWinner(rememberBoard(s), top.player.id))}>
                  Crown {top ? top.player.displayName : 'the winner'} →
                </button>
              ) : (
                <button type="button" className="big" onClick={() => apply(s => goToRound(rememberBoard(s), s.round.status === 'ready' ? s.round.index : s.round.index + 1))}>
                  {r.status === 'ready' ? `Back to Round ${r.index + 1} →` : `Round ${r.index + 2} →`}
                </button>
              ))}
            {game.phase === 'wheel' && <span className="chip">{spin ? 'Spun' : `Waiting for ${winner?.displayName ?? 'the winner'} to spin`}</span>}
          </div>
          <div className="group">
            {game.phase === 'round' && (
              <span className="chip num">
                {buzzes.length} buzz{buzzes.length === 1 ? '' : 'es'}
              </span>
            )}
            <span className="chip num">{contestants.length} players</span>
          </div>
        </div>
      </nav>
    </div>
  );
}
