'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BuzzList } from '@/components/views';
import { ConfirmButton, Loading, TeamChip, TopBar, useToast } from '@/components/ui';
import { getBackend } from '@/lib/backend';
import { DEMO } from '@/lib/config';
import {
  TEAM_LABEL,
  activeTeams,
  adjustPoints,
  assignTeams,
  closeRound,
  crownWinner,
  currentAttempt,
  goToRound,
  initialState,
  judge,
  placeholderSongs,
  rankPlayers,
  rememberBoard,
  resetGame,
  resetRound,
  revealAnswer,
  setPhase,
  showLeaderboard,
  suggestTeamCount,
} from '@/lib/game';
import { useBuzzes, useGameState, useGate, useHostActions } from '@/lib/hooks';
import type { Phase, Song } from '@/lib/types';

type Tab = 'run' | 'players' | 'songs' | 'settings';

const PHASES: { id: Phase; label: string }[] = [
  { id: 'lobby', label: 'Lobby' },
  { id: 'game1', label: 'Game 1: drawing' },
  { id: 'teams', label: 'Teams' },
  { id: 'round', label: 'Song rounds' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'wheel', label: 'Prize wheel' },
];

export default function HostPage() {
  const { user, me, players, ready } = useGate({ needHost: true });
  const { game, empty } = useGameState();
  const { apply, error } = useHostActions(game);
  const buzzes = useBuzzes(game?.phase === 'round' ? game.round.key : null);
  const [tab, setTab] = useState<Tab>('run');
  const [songs, setSongs] = useState<Song[]>([]);
  const [showAnswer, setShowAnswer] = useState(true);
  const [includeMe, setIncludeMe] = useState(false);
  const [podium, setPodium] = useState<[string, string, string]>(['', '', '']);
  const [g1, setG1] = useState({ name: '', url: '' });
  const [winnerPick, setWinnerPick] = useState('');
  const toast = useToast();
  const backend = getBackend();

  useEffect(() => {
    if (ready) void backend.fetchSongs().then(list => setSongs(list.length ? list : placeholderSongs()));
  }, [ready, backend]);
  useEffect(() => {
    if (ready && empty) void backend.writeState(initialState());
  }, [ready, empty, backend]);
  useEffect(() => {
    if (game) setG1(game.game1);
    // only when the saved value changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.game1.name, game?.game1.url]);

  const contestants = useMemo(() => players.filter(p => includeMe || p.id !== user?.id), [players, includeMe, user]);
  const ranked = useMemo(() => rankPlayers(contestants, game?.points ?? {}), [contestants, game?.points]);

  if (!ready || !game) return <Loading label="Opening the host console…" />;

  const r = game.round;
  const song = songs.find(s => s.round === r.index + 1);
  const att = currentAttempt(r);
  const nameOf = (id: string) => players.find(p => p.id === id)?.displayName ?? 'Someone';
  const teams = activeTeams(game);

  const saveSongs = async () => {
    const clean = songs.map(s => ({ ...s, start: Math.max(0, Number(s.start) || 0), stop: Math.max(0.5, Number(s.stop) || 0) }));
    const bad = clean.find(s => s.stop <= s.start);
    if (bad) {
      toast.show(`Round ${bad.round}: the stop time must be after the start time.`);
      return;
    }
    const { error } = await backend.saveSongs(clean);
    toast.show(error ? error : 'Songs saved');
  };

  const updateSong = (round: number, patch: Partial<Song>) => setSongs(list => list.map(s => (s.round === round ? { ...s, ...patch } : s)));

  return (
    <>
      <TopBar me={me} host />
      <main className="shell">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <p className="eyebrow">Only you can see this page</p>
            <h2>Host console</h2>
          </div>
          <Link className="btn" href="/stage" target="_blank">
            Open the Stage
          </Link>
        </div>
        <p className="hint">
          Share the <b>Stage</b> tab on Meet with &quot;Also share tab audio&quot; turned on. It plays the songs and runs the buzzers. Keep this console private, for example on your phone,
          to see the correct lines.
        </p>

        <div className="tabs" role="tablist" aria-label="Host sections">
          {(
            [
              ['run', 'Run the game'],
              ['players', `Players (${players.length})`],
              ['songs', 'Songs'],
              ['settings', 'Settings'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'run' && (
          <>
            <section className="card">
              <h3>Jump to</h3>
              <div className="phase-steps">
                {PHASES.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="ghost small"
                    aria-current={game.phase === p.id ? 'step' : undefined}
                    onClick={() =>
                      apply(s => {
                        if (p.id === 'leaderboard') return showLeaderboard(s);
                        if (p.id === 'wheel') {
                          const w = s.winnerId ?? ranked[0]?.player.id;
                          return w ? crownWinner(rememberBoard(s), w) : setPhase(s, 'wheel');
                        }
                        return setPhase(p.id === 'round' && s.phase === 'leaderboard' ? rememberBoard(s) : s, p.id);
                      })
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </section>

            <div className="host-grid">
              <section className="card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h3>
                    Round {r.index + 1} of {game.totalRounds}
                    {r.double ? ' · double points' : ''}
                  </h3>
                  <span className="chip">{r.status}</span>
                </div>
                <div className="secret">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="eyebrow" style={{ color: 'var(--coral)' }}>
                      Correct line (hidden from players)
                    </span>
                    <button type="button" className="ghost small" onClick={() => setShowAnswer(v => !v)}>
                      {showAnswer ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {showAnswer ? (
                    <>
                      <p className="answer-line">{song?.line || 'No line set for this round yet.'}</p>
                      <p className="muted">
                        {song?.title || 'Untitled'} {song?.artist ? `· ${song.artist}` : ''}
                      </p>
                    </>
                  ) : (
                    <p className="muted">Hidden. Tap Show when nobody is looking.</p>
                  )}
                </div>

                {att ? (
                  <p style={{ fontWeight: 800 }}>
                    <TeamChip team={att.team} /> {nameOf(att.playerId)} is answering
                  </p>
                ) : (
                  <p className="muted">
                    {r.status === 'ready' ? 'Press Play on the Stage to start the clip and open the buzzers.' : r.status === 'open' ? 'Waiting for a buzz.' : 'Round finished.'}
                  </p>
                )}

                <div className="row">
                  {r.status === 'answering' && (
                    <>
                      <button type="button" className="teal" onClick={() => apply(s => judge(s, true, buzzes))}>
                        ✓ Correct
                      </button>
                      <button type="button" className="coral" onClick={() => apply(s => judge(s, false, buzzes))}>
                        ✗ Wrong
                      </button>
                    </>
                  )}
                  {(r.status === 'open' || r.status === 'ready') && game.phase === 'round' && (
                    <button type="button" className="ghost" onClick={() => apply(closeRound)}>
                      Nobody knows it
                    </button>
                  )}
                  {r.status !== 'revealed' && game.phase === 'round' && (
                    <button type="button" onClick={() => apply(s => revealAnswer(s, song))}>
                      Reveal the line to everyone
                    </button>
                  )}
                </div>
                <div className="row">
                  <button type="button" className="ghost small" disabled={r.index === 0} onClick={() => apply(s => goToRound(s, s.round.index - 1))}>
                    ← Previous round
                  </button>
                  <button type="button" className="ghost small" disabled={r.index >= game.totalRounds - 1} onClick={() => apply(s => goToRound(rememberBoard(s), s.round.index + 1))}>
                    Next round →
                  </button>
                  <ConfirmButton label="Restart this round" confirmLabel="Click again: undo its points" onConfirm={() => apply(resetRound)} />
                </div>
              </section>

              <BuzzList game={game} players={players} buzzes={buzzes} limit={15} />
            </div>

            <section className="card">
              <h3>Teams</h3>
              <div className="row">
                <label htmlFor="team-count">Number of teams</label>
                <select
                  id="team-count"
                  value={game.teamCount}
                  style={{ width: 'auto' }}
                  onChange={e => apply(s => ({ ...s, teamCount: Number(e.target.value), version: s.version + 1 }))}
                >
                  {[2, 3, 4].map(n => (
                    <option key={n} value={n}>
                      {n} teams
                    </option>
                  ))}
                </select>
                <span className="hint">Suggested for {contestants.length} players: {suggestTeamCount(contestants.length)}</span>
              </div>
              <label className="row" style={{ gap: 8, fontWeight: 600 }}>
                <input type="checkbox" checked={includeMe} onChange={e => setIncludeMe(e.target.checked)} style={{ width: 'auto' }} />
                Put me (the host) on a team too
              </label>
              <div className="row">
                <button type="button" onClick={() => apply(s => assignTeams(s, contestants, s.teamCount))} disabled={contestants.length < 2}>
                  Shuffle teams and show them
                </button>
              </div>
              {teams.length > 0 && (
                <div className="teams-grid">
                  {teams.map(t => (
                    <div key={t} className="team-col" style={{ ['--team' as string]: `var(--team-${t})` }}>
                      <h3>
                        {TEAM_LABEL[t]} · {game.teamScores[t] ?? 0}
                      </h3>
                      {players
                        .filter(p => game.teams[p.id] === t)
                        .map(p => (
                          <span key={p.id} className="name-chip" style={{ animation: 'none' }}>
                            <span className="avatar" aria-hidden="true">
                              {p.avatar}
                            </span>
                            <span>{p.displayName}</span>
                          </span>
                        ))}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'players' && (
          <>
            <section className="card">
              <h3>Game 1 results</h3>
              <p className="hint">After the drawing game, give the top three their points.</p>
              <div className="row">
                {(['1st · +3', '2nd · +2', '3rd · +1'] as const).map((label, i) => (
                  <div key={label} className="field grow" style={{ minWidth: 160 }}>
                    <label htmlFor={`podium-${i}`}>{label}</label>
                    <select
                      id={`podium-${i}`}
                      value={podium[i]}
                      onChange={e => {
                        const next = [...podium] as [string, string, string];
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
                    await apply(s => podium.reduce((acc, pid, i) => (pid ? adjustPoints(acc, pid, 3 - i) : acc), s));
                    setPodium(['', '', '']);
                    toast.show('Game 1 points added');
                  }}
                >
                  Add Game 1 points
                </button>
              </div>
            </section>

            <section className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3>Everyone who joined</h3>
                {DEMO && backend.addBots && (
                  <button type="button" className="ghost small" onClick={() => backend.addBots?.(14)}>
                    Add 14 test players
                  </button>
                )}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Email</th>
                      <th>Team</th>
                      <th>Points</th>
                      <th>
                        <span className="sr">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map(p => (
                      <tr key={p.id}>
                        <td>
                          <span aria-hidden="true">{p.avatar}</span> <b>{p.displayName}</b>
                        </td>
                        <td className="muted">{p.email}</td>
                        <td>{game.teams[p.id] ? <TeamChip team={game.teams[p.id]} /> : <span className="muted">none</span>}</td>
                        <td>
                          <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                            <button type="button" className="ghost small" aria-label={`Take a point from ${p.displayName}`} onClick={() => apply(s => adjustPoints(s, p.id, -1))}>
                              −
                            </button>
                            <b className="num" style={{ minWidth: '2ch', textAlign: 'center' }}>
                              {game.points[p.id] ?? 0}
                            </b>
                            <button type="button" className="ghost small" aria-label={`Give a point to ${p.displayName}`} onClick={() => apply(s => adjustPoints(s, p.id, 1))}>
                              +
                            </button>
                          </span>
                        </td>
                        <td>
                          <ConfirmButton
                            label="Remove"
                            confirmLabel="Click to confirm"
                            onConfirm={async () => {
                              const { error } = await backend.removePlayer(p.id);
                              toast.show(error ?? `Removed ${p.displayName}`);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {tab === 'songs' && (
          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>Guess the next line: {songs.length} rounds</h3>
              <button type="button" onClick={saveSongs}>
                Save songs
              </button>
            </div>
            <p className="hint">
              For each round: an audio file URL (for example <code>/songs/round1.mp3</code> in the project&apos;s <code>public/songs</code> folder) or a YouTube link, the second the clip
              starts, the second it stops (just before the line), and the correct next line. Only hosts can read this table.
            </p>
            <div className="table-wrap">
              <table style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Song</th>
                    <th>Artist</th>
                    <th>Audio file or YouTube link</th>
                    <th>Start (s)</th>
                    <th>Stop (s)</th>
                    <th>Correct next line</th>
                  </tr>
                </thead>
                <tbody>
                  {songs.map(s => (
                    <tr key={s.round}>
                      <td className="num">{s.round}</td>
                      <td>
                        <input aria-label={`Round ${s.round} song`} value={s.title} onChange={e => updateSong(s.round, { title: e.target.value })} />
                      </td>
                      <td>
                        <input aria-label={`Round ${s.round} artist`} value={s.artist} onChange={e => updateSong(s.round, { artist: e.target.value })} />
                      </td>
                      <td>
                        <input aria-label={`Round ${s.round} audio`} value={s.source} onChange={e => updateSong(s.round, { source: e.target.value })} />
                      </td>
                      <td style={{ width: 90 }}>
                        <input aria-label={`Round ${s.round} start`} type="number" min={0} step={0.1} value={s.start} onChange={e => updateSong(s.round, { start: Number(e.target.value) })} />
                      </td>
                      <td style={{ width: 90 }}>
                        <input aria-label={`Round ${s.round} stop`} type="number" min={0} step={0.1} value={s.stop} onChange={e => updateSong(s.round, { stop: Number(e.target.value) })} />
                      </td>
                      <td>
                        <input aria-label={`Round ${s.round} correct line`} value={s.line} onChange={e => updateSong(s.round, { line: e.target.value })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'settings' && (
          <div className="host-grid">
            <section className="card">
              <h3>Game 1: drawing game</h3>
              <p className="hint">Pick the game (skribbl.io, Gartic Phone…), create a private room, and paste the invite link. Players see a Join button.</p>
              <div className="field">
                <label htmlFor="g1-name">Game name</label>
                <input id="g1-name" value={g1.name} placeholder="e.g. skribbl.io" onChange={e => setG1({ ...g1, name: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="g1-url">Invite link</label>
                <input id="g1-url" type="url" value={g1.url} placeholder="https://…" onChange={e => setG1({ ...g1, url: e.target.value })} />
              </div>
              <div className="row">
                <button
                  type="button"
                  onClick={async () => {
                    const url = g1.url.trim();
                    if (url && !/^https?:\/\//i.test(url)) {
                      toast.show('The link must start with https://');
                      return;
                    }
                    await apply(s => ({ ...s, game1: { name: g1.name.trim(), url }, version: s.version + 1 }));
                    toast.show('Game 1 saved');
                  }}
                >
                  Save Game 1
                </button>
              </div>
            </section>

            <section className="card">
              <h3>Winner and prize wheel</h3>
              <p className="hint">The top scorer is picked by default. Choose someone else to break a tie.</p>
              <div className="field">
                <label htmlFor="winner">Winner</label>
                <select id="winner" value={winnerPick || game.winnerId || ranked[0]?.player.id || ''} onChange={e => setWinnerPick(e.target.value)}>
                  {ranked.map(x => (
                    <option key={x.player.id} value={x.player.id}>
                      #{x.rank} {x.player.displayName} · {x.points} pts
                    </option>
                  ))}
                </select>
              </div>
              <div className="row">
                <button
                  type="button"
                  disabled={!ranked.length}
                  onClick={() => {
                    const id = winnerPick || game.winnerId || ranked[0]?.player.id;
                    if (id) void apply(s => crownWinner(rememberBoard(s), id));
                  }}
                >
                  Open the wheel for the winner
                </button>
                <ConfirmButton
                  label="Reset the wheel"
                  confirmLabel="Click again to reset"
                  onConfirm={async () => {
                    const { error } = await backend.resetWheel();
                    toast.show(error ?? 'Wheel reset. The winner can spin again.');
                  }}
                />
              </div>
            </section>

            <section className="card">
              <h3>Start over</h3>
              <p className="hint">Clears scores, teams, buzzes and the wheel. Players and songs stay.</p>
              <div className="row">
                <ConfirmButton
                  label="Reset the whole game"
                  confirmLabel="Click again to reset everything"
                  onConfirm={async () => {
                    await apply(resetGame);
                    await backend.clearBuzzes();
                    await backend.resetWheel();
                    toast.show('Game reset');
                  }}
                />
                {DEMO && backend.resetDemo && (
                  <ConfirmButton label="Wipe demo data" confirmLabel="Click again to wipe" onConfirm={() => backend.resetDemo?.()} />
                )}
              </div>
            </section>
          </div>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </main>
      {toast.node}
    </>
  );
}
