'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { checkSource } from '@/components/SongPlayer';
import { TimingTool } from '@/components/TimingTool';
import { BuzzList } from '@/components/views';
import { ConfirmButton, Loading, TopBar, useToast } from '@/components/ui';
import { getBackend } from '@/lib/backend';
import { DEMO } from '@/lib/config';
import {
  PHASE_LABEL,
  adjustPoints,
  closeRound,
  currentAttempt,
  goToRound,
  initialState,
  judge,
  placeholderSongs,
  playersOnly,
  rankPlayers,
  resetGame,
  resetRound,
  revealAnswer,
  roundFinished,
  setTotalRounds,
  songReady,
} from '@/lib/game';
import { useBuzzEngine, useBuzzes, useGameState, useGate, useHostActions, useRegisterHost, useSongs } from '@/lib/hooks';
import { GAME_NIGHT_SONGS } from '@/lib/songLists';
import type { Song } from '@/lib/types';

type Tab = 'songs' | 'players' | 'reset';

function songStatus(s: Song): { label: string; ok: boolean } {
  if (!s.source.trim()) return { label: 'Needs a link', ok: false };
  if (!(s.stop > s.start)) return { label: 'Needs timing', ok: false };
  if (!s.line.trim()) return { label: 'Needs the line', ok: false };
  return { label: 'Ready', ok: true };
}

export default function HostPage() {
  const { user, me, players, ready } = useGate({ needHost: true });
  const { game, empty } = useGameState();
  const { apply, error } = useHostActions(game);
  const buzzes = useBuzzes(game?.phase === 'round' ? game.round.key : null);
  const [tab, setTab] = useState<Tab>('songs');
  const [timing, setTiming] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [checks, setChecks] = useState<Record<number, 'checking' | { ok: boolean; reason?: string }>>({});
  const [checking, setChecking] = useState(false);
  const checkBox = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const backend = getBackend();
  const { songs, setSongs } = useSongs(ready, game, apply, { onNotice: m => toast.show(m) });

  useBuzzEngine(game, buzzes, apply);
  useRegisterHost(game, user?.id, apply);

  // The number of song rounds follows the song list.
  useEffect(() => {
    if (songs.length) void apply(s => setTotalRounds(s, songs.length));
  }, [songs.length, apply]);

  useEffect(() => {
    if (ready && empty) void backend.writeState(initialState(), null);
  }, [ready, empty, backend]);

  const contestants = useMemo(() => playersOnly(players, game, user?.id), [players, game, user]);
  const ranked = useMemo(() => rankPlayers(contestants, game?.points ?? {}), [contestants, game?.points]);

  if (!ready || !game) return <Loading label="Opening the answer sheet…" />;

  const r = game.round;
  const song = songs.find(s => s.round === r.index + 1);
  const att = currentAttempt(r);
  const nameOf = (id: string) => players.find(p => p.id === id)?.displayName ?? 'Someone';

  const save = async (list: Song[], quiet = false) => {
    const clean = list.map(s => ({ ...s, start: Math.max(0, Number(s.start) || 0), stop: Math.max(0, Number(s.stop) || 0) }));
    const { error } = await backend.saveSongs(clean);
    if (!error) setDirty(false);
    if (error || !quiet) toast.show(error ?? 'Songs saved');
  };
  const update = (round: number, patch: Partial<Song>, autosave = false) => {
    const next = songs.map(s => (s.round === round ? { ...s, ...patch } : s));
    setSongs(next);
    if (autosave) void save(next, true);
    else setDirty(true);
  };
  /** Change the play order: songs play in the order shown. */
  const move = (round: number, dir: -1 | 1) => {
    const i = songs.findIndex(s => s.round === round);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= songs.length) return;
    const next = songs.slice();
    [next[i], next[j]] = [next[j], next[i]];
    const renumbered = next.map((s, k) => ({ ...s, round: k + 1 }));
    setSongs(renumbered);
    setTiming(null);
    setChecks({});
    void save(renumbered, true);
    toast.show(`"${songs[i].title || 'Song'}" is now song ${j + 1}`);
  };
  const loadList = async (list: Song[], label: string) => {
    const copy = list.map(s => ({ ...s }));
    setSongs(copy);
    setTiming(null);
    const { error } = await backend.saveSongs(copy);
    toast.show(error ?? `${label} loaded`);
  };

  return (
    <>
      <TopBar me={me} host />
      <main className="shell">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <p className="eyebrow">Only you can see this page · keep it off the shared screen</p>
            <h2>Answer sheet</h2>
          </div>
          <Link className="btn" href="/stage" target="_blank">
            Open the Stage
          </Link>
        </div>

        <section className="card" style={{ borderColor: 'var(--coral)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>Now: {PHASE_LABEL[game.phase]}</h3>
            {game.phase === 'round' && (
              <span className="chip">
                Song {r.index + 1} of {game.totalRounds} · {r.status}
              </span>
            )}
          </div>
          {game.phase !== 'round' ? (
            <p className="muted">Run the game from the Stage. During the songs, this card shows the correct line and the judge buttons.</p>
          ) : (
            <>
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
                    <p className="answer-line">{song?.line || 'No line typed for this song yet (Songs tab below).'}</p>
                    <p className="muted">
                      {song?.title || 'Untitled'}
                      {song?.artist ? ` · ${song.artist}` : ''}
                    </p>
                  </>
                ) : (
                  <p className="muted">Hidden.</p>
                )}
              </div>
              <p style={{ fontWeight: 800 }}>
                {att
                  ? `${nameOf(att.playerId)} is answering`
                  : r.status === 'ready'
                    ? 'Press ▶ Play song on the Stage.'
                    : r.status === 'open'
                      ? 'Waiting for a buzz…'
                      : 'Song finished.'}
              </p>
              <div className="row">
                {r.status === 'answering' && (
                  <>
                    <button type="button" className="teal big" onClick={() => apply(s => judge(s, true, buzzes))}>
                      ✓ Correct
                    </button>
                    <button type="button" className="coral big" onClick={() => apply(s => judge(s, false, buzzes))}>
                      ✗ Wrong
                    </button>
                  </>
                )}
                {r.status === 'open' && (
                  <button type="button" className="ghost" onClick={() => apply(closeRound)}>
                    Nobody knows it
                  </button>
                )}
                {r.status !== 'revealed' && r.status !== 'ready' && (
                  <button type="button" onClick={() => apply(s => revealAnswer(s, song))}>
                    Reveal the line
                  </button>
                )}
                {roundFinished(r) && r.index < game.totalRounds - 1 && (
                  <button type="button" onClick={() => apply(s => goToRound(s, s.round.index + 1))}>
                    Next song →
                  </button>
                )}
              </div>
              <div className="row">
                <button type="button" className="ghost small" disabled={r.index === 0} onClick={() => apply(s => goToRound(s, s.round.index - 1))}>
                  ← Previous song
                </button>
                <button type="button" className="ghost small" disabled={r.index >= game.totalRounds - 1} onClick={() => apply(s => goToRound(s, s.round.index + 1))}>
                  Skip to next song
                </button>
                <ConfirmButton label="Restart this song" confirmLabel="Click again: undo its points" onConfirm={() => apply(resetRound)} />
              </div>
              <BuzzList game={game} players={players} buzzes={buzzes} limit={15} />
            </>
          )}
        </section>

        <div className="tabs" role="tablist" aria-label="Setup">
          {(
            [
              ['songs', 'Songs'],
              ['players', `Players (${contestants.length})`],
              ['reset', 'Reset'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'songs' && (
          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>Guess the line · {songs.length} songs</h3>
              <button type="button" onClick={() => save(songs)} className={dirty ? '' : 'ghost'}>
                {dirty ? 'Save changes' : 'Saved'}
              </button>
            </div>
            <div className="row">
              <ConfirmButton
                label="Load practice songs (ready to play)"
                confirmLabel="Click again: replace the list"
                onConfirm={() => loadList(placeholderSongs(), 'Practice songs')}
              />
              <ConfirmButton
                label={`Load the game night songs (${GAME_NIGHT_SONGS.length})`}
                confirmLabel="Click again: replace the list"
                onConfirm={() => loadList(GAME_NIGHT_SONGS, 'Game night songs')}
              />
              <button
                type="button"
                className="teal"
                disabled={checking || !songs.length}
                onClick={async () => {
                  if (!checkBox.current) return;
                  setChecking(true);
                  setChecks({});
                  for (const s of songs) {
                    setChecks(c => ({ ...c, [s.round]: 'checking' }));
                    const res = await checkSource(s.source, checkBox.current);
                    setChecks(c => ({ ...c, [s.round]: res }));
                  }
                  setChecking(false);
                }}
              >
                {checking ? 'Checking…' : 'Check all songs play'}
              </button>
            </div>
            <p className="hint">
              <b>Practice songs</b> are old public-domain tunes that work right away. The <b>game night songs</b> come with their official YouTube videos and your
              clip times: type each correct line in the last box, and use <b>Set timing</b> → <b>Test the clip</b> to check or nudge a clip.
            </p>

            <div ref={checkBox} className="yt-box" hidden={!checking} aria-hidden="true" />
            {Object.keys(checks).length > 0 && !checking && (
              <p className={Object.values(checks).every(c => c !== 'checking' && c.ok) ? 'ok' : 'error'}>
                {Object.values(checks).filter(c => c !== 'checking' && c.ok).length} of {songs.length} songs play in this browser.
                {Object.values(checks).some(c => c !== 'checking' && !c.ok) ? ' Swap the ones marked ✗ for another upload of the song.' : ''}
              </p>
            )}

            {timing !== null && songs.find(s => s.round === timing) && (
              <TimingTool song={songs.find(s => s.round === timing)!} onChange={patch => update(timing, patch, true)} onClose={() => setTiming(null)} />
            )}

            <div className="table-wrap">
              <table className="stack" style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Song</th>
                    <th>Artist</th>
                    <th>Audio file or YouTube link</th>
                    <th>Clip</th>
                    <th>Correct next line</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {songs.map(s => {
                    const st = songStatus(s);
                    return (
                      <tr key={s.round}>
                        <td data-label="Order">
                          <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                            <b className="num" style={{ minWidth: '2ch' }}>
                              {s.round}
                            </b>
                            <button type="button" className="ghost small" aria-label={`Move ${s.title || 'song'} up`} disabled={s.round === 1} onClick={() => move(s.round, -1)}>
                              ↑
                            </button>
                            <button
                              type="button"
                              className="ghost small"
                              aria-label={`Move ${s.title || 'song'} down`}
                              disabled={s.round === songs.length}
                              onClick={() => move(s.round, 1)}
                            >
                              ↓
                            </button>
                          </span>
                        </td>
                        <td data-label="Song">
                          <input aria-label={`Song ${s.round} title`} value={s.title} onChange={e => update(s.round, { title: e.target.value })} />
                        </td>
                        <td data-label="Artist">
                          <input aria-label={`Song ${s.round} artist`} value={s.artist} onChange={e => update(s.round, { artist: e.target.value })} />
                        </td>
                        <td data-label="Audio file or YouTube link">
                          <input aria-label={`Song ${s.round} audio`} value={s.source} onChange={e => update(s.round, { source: e.target.value })} />
                        </td>
                        <td data-label="Clip">
                          <span className="num muted" style={{ marginRight: 8 }}>
                            {s.stop > s.start ? `${s.start}s → ${s.stop}s` : '—'}
                          </span>
                          <button type="button" className="ghost small" onClick={() => setTiming(s.round)}>
                            Set timing
                          </button>
                        </td>
                        <td data-label="Correct next line">
                          <input
                            aria-label={`Song ${s.round} correct line`}
                            placeholder="Type the line players must sing"
                            value={s.line}
                            onChange={e => update(s.round, { line: e.target.value })}
                          />
                        </td>
                        <td data-label="Status">
                          <span className="chip" style={{ color: st.ok ? 'var(--teal)' : 'var(--coral)' }}>
                            {st.label}
                          </span>
                          {checks[s.round] === 'checking' && <div className="hint">Checking…</div>}
                          {checks[s.round] && checks[s.round] !== 'checking' && (
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: (checks[s.round] as { ok: boolean }).ok ? 'var(--teal)' : 'var(--coral)' }}>
                              {(checks[s.round] as { ok: boolean; reason?: string }).ok ? '✓ Plays' : `✗ ${(checks[s.round] as { reason?: string }).reason}`}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="hint">
              {songs.filter(s => songReady(s) && s.line.trim()).length} of {songs.length} songs are ready. Audio files can go in the project&apos;s <code>public/songs</code>{' '}
              folder (then use <code>/songs/name.mp3</code>).
            </p>
          </section>
        )}

        {tab === 'players' && (
          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>Everyone who joined</h3>
              {DEMO && backend.addBots && (
                <button type="button" className="ghost small" onClick={() => backend.addBots?.(14)}>
                  Add 14 test players
                </button>
              )}
            </div>
            <p className="hint">Fix any score with − and +. Remove people who shouldn&apos;t be here.</p>
            <div className="table-wrap">
              <table className="stack">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Email</th>
                    <th>Points</th>
                    <th>
                      <span className="sr">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map(({ player: p, points, rank }) => (
                    <tr key={p.id}>
                      <td className="num">{rank}</td>
                      <td data-label="Player">
                        <span aria-hidden="true">{p.avatar}</span> <b>{p.displayName}</b>
                      </td>
                      <td data-label="Email" className="muted">{p.email}</td>
                      <td data-label="Points">
                        <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                          <button type="button" className="ghost small" aria-label={`Take a point from ${p.displayName}`} onClick={() => apply(s => adjustPoints(s, p.id, -1))}>
                            −
                          </button>
                          <b className="num" style={{ minWidth: '2ch', textAlign: 'center' }}>
                            {points}
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
        )}

        {tab === 'reset' && (
          <section className="card">
            <h3>Start over</h3>
            <p className="hint">Use this after a practice run. It clears points, buzzes, the skribbl link and the wheel. Players and songs stay.</p>
            <div className="row">
              <ConfirmButton
                label="Reset the whole game"
                confirmLabel="Click again to reset everything"
                onConfirm={async () => {
                  await apply(resetGame);
                  await backend.clearBuzzes();
                  await backend.resetWheel();
                  toast.show('Game reset. Everyone is back in the lobby.');
                }}
              />
              <ConfirmButton
                label="Reset only the wheel"
                confirmLabel="Click again to reset"
                onConfirm={async () => {
                  const { error } = await backend.resetWheel();
                  toast.show(error ?? 'Wheel reset');
                }}
              />
              {DEMO && backend.resetDemo && <ConfirmButton label="Wipe demo data" confirmLabel="Click again to wipe" onConfirm={() => backend.resetDemo?.()} />}
            </div>
          </section>
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
