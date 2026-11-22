'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrizeReveal, celebrate } from '@/components/PrizeReveal';
import { SongPlayer, type PlayRange, type SongPlayerHandle } from '@/components/SongPlayer';
import { Wheel } from '@/components/Wheel';
import { BuzzList, FinalResults, Game1View, LiveBoard, LobbyView, RoundHeader, RoundStatusBoard } from '@/components/views';
import { Bulbs, ConfirmButton, DemoBanner, Loading, SoundToggle } from '@/components/ui';
import { getBackend } from '@/lib/backend';
import { DEMO } from '@/lib/config';
import {
  PHASE_LABEL,
  PHASE_ORDER,
  closeRound,
  crownWinner,
  goToRound,
  initialState,
  judge,
  openBuzzers,
  playersOnly,
  rankPlayers,
  revealAnswer,
  roundFinished,
  roundWinner,
  setGame1Link,
  setClip,
  setGame1Podium,
  setPlayback,
  setPhase,
  songReady,
} from '@/lib/game';
import { useBuzzEngine, useBuzzes, useGameState, useGate, useHostActions, useRegisterHost, useWheel } from '@/lib/hooks';
import { sfx } from '@/lib/sfx';
import type { GameState, Player, Song } from '@/lib/types';

function Game1HostPanel({ game, contestants, apply }: { game: GameState; contestants: Player[]; apply: ReturnType<typeof useHostActions>['apply'] }) {
  const [url, setUrl] = useState(game.game1.url);
  const [podium, setPodium] = useState<string[]>(['', '', '']);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => setUrl(game.game1.url), [game.game1.url]);
  useEffect(() => setPodium([0, 1, 2].map(i => game.game1.podium[i] ?? '')), [game.game1.podium]);

  return (
    <section className="card" style={{ borderColor: 'var(--teal)' }}>
      <p className="eyebrow">Host · skribbl setup</p>
      <div className="host-grid">
        <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <h3>1. Share the room</h3>
          <p className="hint">
            Open{' '}
            <a href="https://skribbl.io" target="_blank" rel="noopener noreferrer">
              skribbl.io
            </a>
            , type your name, click <b>Create Private Room</b>, then copy the invite link and paste it here.
          </p>
          <div className="row">
            <input aria-label="skribbl invite link" className="grow" placeholder="https://skribbl.io/?…" value={url} onChange={e => setUrl(e.target.value)} />
            <button
              type="button"
              onClick={async () => {
                const u = url.trim();
                if (u && !/^https?:\/\//i.test(u)) {
                  setNote('Paste the full link, starting with https://');
                  return;
                }
                await apply(s => setGame1Link(s, 'skribbl.io', u));
                setNote(u ? 'Everyone now sees the Join button.' : 'Link removed.');
              }}
            >
              Show to everyone
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <h3>2. When skribbl ends, who won?</h3>
          <div className="row">
            {['1st · +3', '2nd · +2', '3rd · +1'].map((label, i) => (
              <div key={label} className="field grow" style={{ minWidth: 140 }}>
                <label htmlFor={`podium-${i}`}>{label}</label>
                <select
                  id={`podium-${i}`}
                  value={podium[i]}
                  onChange={e => {
                    const next = [...podium];
                    next[i] = e.target.value;
                    setPodium(next);
                  }}
                >
                  <option value="">Pick a player</option>
                  {contestants.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="row">
            <button
              type="button"
              disabled={!podium.some(Boolean)}
              onClick={async () => {
                const clean = podium.filter((p, i) => p && podium.indexOf(p) === i);
                if (clean.length !== podium.filter(Boolean).length) {
                  setNote('Pick three different players.');
                  return;
                }
                await apply(s => setGame1Podium(s, podium));
                setNote('Points given. Saving again replaces them, so fixing a mistake is safe.');
              }}
            >
              Give the points
            </button>
          </div>
        </div>
      </div>
      {note && <p className="ok">{note}</p>}
    </section>
  );
}

export default function StagePage() {
  const { user, players, ready } = useGate({ needHost: true });
  const { game, empty } = useGameState();
  const { apply, error } = useHostActions(game);
  const buzzes = useBuzzes(game?.phase === 'round' ? game.round.key : null);
  const { spin, fresh } = useWheel();
  const [songs, setSongs] = useState<Song[]>([]);
  const [showPrize, setShowPrize] = useState(false);
  const [localSpin, setLocalSpin] = useState<number | null>(null);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [winnerPick, setWinnerPick] = useState('');
  const [origin, setOrigin] = useState('');
  const player = useRef<SongPlayerHandle>(null);
  const backend = getBackend();

  const contestants = useMemo(() => playersOnly(players, game, user?.id), [players, game, user]);
  const ranked = useMemo(() => rankPlayers(contestants, game?.points ?? {}), [contestants, game?.points]);
  const song = songs.find(s => s.round === (game?.round.index ?? 0) + 1) ?? null;

  useEffect(() => setOrigin(window.location.host), []);

  useEffect(() => {
    if (!ready) return;
    const load = () => backend.fetchSongs().then(setSongs);
    void load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [ready, backend]);

  useEffect(() => {
    if (ready && empty) void backend.writeState(initialState(), null);
  }, [ready, empty, backend]);

  useBuzzEngine(game, buzzes, apply);
  useRegisterHost(game, user?.id, apply);

  // Share the current song's link and timing so players' phones load it before Play.
  useEffect(() => {
    if (!game || game.phase !== 'round' || !songs.length) return;
    void apply(s => (s.phase === 'round' ? setClip(s, songs.find(x => x.round === s.round.index + 1)) : null));
  }, [game?.phase, game?.round.key, songs, apply]); // eslint-disable-line react-hooks/exhaustive-deps

  // Someone buzzed: stop the music.
  const answeringSeq = game?.round.status === 'answering' ? game.round.attempts.length : 0;
  useEffect(() => {
    if (answeringSeq > 0) {
      player.current?.pause();
      sfx.buzz();
    }
  }, [answeringSeq]);

  // Keep a record of every finished song.
  const roundDone = game && (game.round.status === 'won' || game.round.status === 'failed') ? `${game.round.key}:${game.round.status}` : null;
  useEffect(() => {
    if (!roundDone || !game) return;
    const w = roundWinner(game.round);
    if (game.round.status === 'won') void celebrate();
    void backend.logRound({
      round: game.round.index + 1,
      roundKey: game.round.key,
      outcome: game.round.status === 'won' ? 'won' : 'failed',
      team: null,
      answeredBy: w?.playerId ?? null,
      points: game.round.awarded ? { [game.round.awarded.playerId]: game.round.awarded.pts } : {},
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundDone]);

  useEffect(() => {
    if (!spin) setLocalSpin(null);
  }, [spin]);

  // Demo mode: test players buzz on their own so you can try the flow alone.
  const botWindow = game?.phase === 'round' && (game.round.status === 'open' || game.round.status === 'answering') ? game.round.key : null;
  useEffect(() => {
    if (!DEMO || !botWindow || !backend.botBuzz) return;
    const bots = players.filter(p => p.isBot);
    const timers = bots.map(p => (Math.random() < 0.5 ? setTimeout(() => void backend.botBuzz?.(botWindow, p.id, 0), 1200 + Math.random() * 4000) : null));
    return () => timers.forEach(t => t && clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botWindow]);

  if (!ready || !game) return <Loading label="Opening the stage…" />;

  const r = game.round;
  const isLast = r.index >= game.totalRounds - 1;
  const winner = players.find(p => p.id === game.winnerId);
  const chosenWinner = winnerPick || ranked[0]?.player.id || '';
  const segment = spin?.segment ?? localSpin;
  const seed = segment === null ? null : `${segment}-${game.winnerId}`;

  const goPhase = (phase: GameState['phase']) =>
    apply(s => {
      if (phase === 'wheel') {
        const w = s.winnerId ?? ranked[0]?.player.id;
        return w ? crownWinner(s, w) : setPhase(s, 'wheel');
      }
      return setPhase(s, phase);
    });

  // Every play/pause on the Stage is also sent to players' phones.
  const sendPlay = (range: PlayRange | null) =>
    apply(s => {
      let n = s.phase === 'round' && s.round.status === 'ready' ? openBuzzers(s) : s;
      n = setClip(n, song) ?? n;
      return range ? setPlayback(n, 'playing', range.from, range.until) : n;
    });
  const play = async () => {
    sfx.unlock();
    await sendPlay(player.current?.play() ?? null);
  };
  const pause = () => {
    player.current?.pause();
    void apply(s => setPlayback(s, 'paused'));
  };
  const stop = () => {
    player.current?.stop();
    void apply(s => setPlayback(s, 'stopped'));
  };
  const restart = async () => {
    await sendPlay(player.current?.restart() ?? null);
  };
  const playAnswer = async () => {
    const range = player.current?.playAnswer() ?? null;
    if (range) await apply(s => setPlayback(s, 'playing', range.from, range.until));
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
                Answer sheet
              </Link>
            </div>
          </div>
        </header>
      </div>

      <main className="stage-main">
        <nav className="phase-steps" aria-label="Game steps">
          {PHASE_ORDER.map((p, i) => (
            <button key={p} type="button" className="ghost small" aria-current={game.phase === p ? 'step' : undefined} onClick={() => goPhase(p)}>
              {i + 1}. {PHASE_LABEL[p]}
            </button>
          ))}
        </nav>

        {game.phase === 'lobby' && (
          <>
            <div className="marquee" style={{ width: '100%' }}>
              <Bulbs count={24} />
              <p className="eyebrow">Join now</p>
              <h1 style={{ fontSize: 'clamp(2.6rem, 8vw, 5.4rem)' }}>Game Night</h1>
              <p className="join-url">{origin}</p>
              <p className="muted">Sign in, pick a name, and you&apos;ll pop up below.</p>
              <Bulbs count={24} />
            </div>
            <LobbyView players={contestants} big />
          </>
        )}

        {game.phase === 'game1' && (
          <>
            <Game1View game={game} players={contestants} />
            <Game1HostPanel game={game} contestants={contestants} apply={apply} />
          </>
        )}

        {game.phase === 'round' && (
          <div className="stage-round">
            <div style={{ display: 'grid', gap: 16 }}>
              <RoundHeader game={game} />
              <RoundStatusBoard game={game} players={players} />
              {r.status === 'ready' && !song?.source.trim() && (
                <p className="error">This song has no link yet. Open the Answer sheet → Songs to add one.</p>
              )}
              {r.status === 'ready' && !!song?.source.trim() && !songReady(song) && (
                <p className="hint">This song has no stop time yet, so press Pause yourself right before the line. Set one in Answer sheet → Songs → Set timing.</p>
              )}
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <SongPlayer ref={player} song={song} />
              <div className="card" style={{ gap: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h3>Song plays on</h3>
                  <div className="tabs" role="group" aria-label="Where the song plays">
                    <button type="button" aria-selected={game.playOnDevices} onClick={() => apply(s => ({ ...s, playOnDevices: true }))}>
                      Everyone&apos;s phones
                    </button>
                    <button type="button" aria-selected={!game.playOnDevices} onClick={() => apply(s => ({ ...s, playOnDevices: false }))}>
                      Only this screen
                    </button>
                  </div>
                </div>
                <p className="hint">
                  {game.playOnDevices
                    ? 'Each player hears the song on their own device and it stops there when someone buzzes. On Meet, share this tab without tab audio so nobody hears it twice.'
                    : 'Only this screen plays the song. On Meet, share this tab with "Also share tab audio" turned on.'}
                </p>
              </div>
              <BuzzList game={game} players={players} buzzes={buzzes} limit={8} />
              <LiveBoard game={game} players={contestants} limit={6} />
            </div>
          </div>
        )}

        {game.phase === 'leaderboard' && (
          <>
            <FinalResults game={game} players={contestants} big />
            <section className="card" style={{ borderColor: 'var(--bulb)' }}>
              <h3>Host · crown the winner</h3>
              <div className="row">
                <select aria-label="Winner" value={chosenWinner} onChange={e => setWinnerPick(e.target.value)} style={{ width: 'auto', minWidth: 220 }}>
                  {ranked.map(x => (
                    <option key={x.player.id} value={x.player.id}>
                      #{x.rank} {x.player.displayName} · {x.points} pts
                    </option>
                  ))}
                </select>
                <button type="button" className="big" disabled={!chosenWinner} onClick={() => apply(s => crownWinner(s, chosenWinner))}>
                  Open the prize wheel →
                </button>
              </div>
              <p className="hint">The top scorer is picked for you. Choose someone else only to break a tie.</p>
            </section>
          </>
        )}

        {game.phase === 'wheel' && (
          <section className="card" style={{ justifyItems: 'center', textAlign: 'center', gap: 18 }}>
            <p className="eyebrow">The finale</p>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.4rem)' }}>{winner ? `${winner.avatar} ${winner.displayName}` : 'Pick a winner first'}</h2>
            <p className="muted">{segment !== null ? 'The wheel has spoken.' : 'Three mystery gifts, two heartbreaks, one spin.'}</p>
            <Wheel segment={segment} seed={seed} animate={fresh || localSpin !== null} onDone={() => setShowPrize(true)} />
            {segment === null ? (
              <button
                type="button"
                className="big"
                disabled={!winner}
                onClick={async () => {
                  sfx.unlock();
                  setSpinError(null);
                  const res = await backend.spin();
                  if (res.error) setSpinError(res.error);
                  else if (typeof res.segment === 'number') setLocalSpin(res.segment);
                }}
              >
                Spin for {winner?.displayName ?? 'the winner'}
              </button>
            ) : (
              <div className="row" style={{ justifyContent: 'center' }}>
                <button type="button" className="ghost" onClick={() => setShowPrize(true)}>
                  Show the prize
                </button>
                <ConfirmButton
                  label="Reset the wheel"
                  confirmLabel="Click again to reset"
                  onConfirm={async () => {
                    const { error } = await backend.resetWheel();
                    if (error) setSpinError(error);
                    setLocalSpin(null);
                  }}
                />
              </div>
            )}
            <p className="hint">The winner can also spin from their own phone.</p>
            {spinError && (
              <p className="error" role="alert">
                {spinError}
              </p>
            )}
            {showPrize && segment !== null && (
              <PrizeReveal segment={segment} winnerName={winner?.displayName ?? 'Our champion'} isWinner={false} onClose={() => setShowPrize(false)} />
            )}
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
                Start skribbl →
              </button>
            )}
            {game.phase === 'game1' && (
              <button type="button" className="big" onClick={() => apply(s => setPhase(s, 'round'))}>
                Start Guess the line →
              </button>
            )}
            {game.phase === 'round' && (
              <>
                {r.status === 'ready' && (
                  <button type="button" className="big" onClick={play}>
                    ▶ Play song
                  </button>
                )}
                {(r.status === 'open' || r.status === 'answering') && (
                  <>
                    <button type="button" className="teal" onClick={play}>
                      ▶ Play
                    </button>
                    <button type="button" className="ghost" onClick={pause}>
                      ❚❚ Pause
                    </button>
                    <button type="button" className="ghost" onClick={stop}>
                      ■ Stop
                    </button>
                    <button type="button" className="ghost" onClick={restart}>
                      ↺ Restart
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
                  <button type="button" className="ghost" onClick={playAnswer}>
                    ▶ Play the real line
                  </button>
                )}
                {roundFinished(r) &&
                  (isLast ? (
                    <button type="button" className="big" onClick={() => apply(s => setPhase(s, 'leaderboard'))}>
                      Final results →
                    </button>
                  ) : (
                    <button type="button" className={r.status === 'revealed' ? 'big' : 'ghost'} onClick={() => apply(s => goToRound(s, s.round.index + 1))}>
                      Next song →
                    </button>
                  ))}
              </>
            )}
            {game.phase === 'leaderboard' && <span className="chip">Pick the winner above, then open the wheel</span>}
            {game.phase === 'wheel' && <span className="chip">{segment !== null ? 'Spun! Send the voucher privately.' : `Waiting for ${winner?.displayName ?? 'the winner'} to spin`}</span>}
          </div>
          <div className="group">
            {game.phase === 'round' && (
              <span className="chip num">
                {buzzes.length} buzz{buzzes.length === 1 ? '' : 'es'}
              </span>
            )}
            <span className="chip num">
              {contestants.length} player{contestants.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </nav>
    </div>
  );
}
