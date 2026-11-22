'use client';

import { ANSWER_MS, CORRECT_POINTS, PODIUM_POINTS, currentAttempt, rankPlayers, roundWinner, sortBuzzes } from '@/lib/game';
import type { Buzz, GameState, Player } from '@/lib/types';
import { AnimatedBoard, type BoardRow } from './AnimatedBoard';
import { RingTimer } from './RingTimer';

const byId = (players: Player[], id: string | null | undefined) => players.find(p => p.id === id);
const nameOf = (players: Player[], id: string | null | undefined) => byId(players, id)?.displayName ?? 'Someone';

/* ------------------------------------------------------------------ */
/* Lobby                                                               */
/* ------------------------------------------------------------------ */

export function LobbyView({ players, meId, big }: { players: Player[]; meId?: string; big?: boolean }) {
  return (
    <section className="card" aria-labelledby="lobby-title" style={{ gap: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'end' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <p className="eyebrow">In the lobby</p>
          <h2 id="lobby-title">{big ? 'Who is here' : "You're in. Waiting for the host"}</h2>
        </div>
        <p className="big-count num" aria-label={`${players.length} players joined`}>
          {players.length}
          <span className="muted" style={{ fontSize: '0.4em' }}>
            {' '}
            joined
          </span>
        </p>
      </div>
      {players.length === 0 ? (
        <p className="muted">Nobody has joined yet. Names show up here the moment people sign in.</p>
      ) : (
        <div className="lobby-grid" aria-live="polite">
          {players.map(p => (
            <span key={p.id} className={`name-chip${p.id === meId ? ' me' : ''}`} style={big ? { fontSize: '1.15rem' } : undefined}>
              <span className="avatar" aria-hidden="true">
                {p.avatar}
              </span>
              <span>{p.displayName}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Game 1: skribbl                                                     */
/* ------------------------------------------------------------------ */

export function Game1View({ game, players }: { game: GameState; players: Player[] }) {
  const { name, url, podium } = game.game1;
  const label = name || 'skribbl.io';
  return (
    <section className="card" style={{ textAlign: 'center', justifyItems: 'center', gap: 16, padding: '34px 22px' }}>
      <p className="eyebrow">Game 1 · Draw and guess</p>
      <h2 style={{ fontSize: 'clamp(2rem, 6vw, 3.6rem)', color: 'var(--bulb)' }}>{label}</h2>
      <p className="lede muted">One person draws, everyone else guesses in the chat. Guess fast to score more.</p>
      {url ? (
        <a className="btn big" href={url} target="_blank" rel="noopener noreferrer">
          Join {label}
        </a>
      ) : (
        <span className="chip">The host is creating the room. The Join button appears here.</span>
      )}
      {podium.some(Boolean) ? (
        <div className="row" style={{ justifyContent: 'center' }}>
          {podium.map((pid, i) =>
            pid ? (
              <span key={pid} className="name-chip" style={{ animation: 'none' }}>
                <span className="avatar" aria-hidden="true">
                  {byId(players, pid)?.avatar}
                </span>
                <span>
                  {['1st', '2nd', '3rd'][i]} · {nameOf(players, pid)} · +{PODIUM_POINTS[i]}
                </span>
              </span>
            ) : null,
          )}
        </div>
      ) : (
        <p className="muted">When it ends, the top 3 get points for the final leaderboard: +3, +2 and +1.</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Guess the line                                                      */
/* ------------------------------------------------------------------ */

export function RoundHeader({ game }: { game: GameState }) {
  return (
    <div className="round-head">
      <strong>
        Song {game.round.index + 1} of {game.totalRounds}
      </strong>
      {game.round.double && <span className="chip double">Double points</span>}
    </div>
  );
}

export function RoundStatusBoard({ game, players, meId }: { game: GameState; players: Player[]; meId?: string }) {
  const r = game.round;
  const att = currentAttempt(r);
  const won = roundWinner(r);
  const lastWrong = r.attempts.filter(a => a.result === 'wrong').at(-1);
  let cls: string = r.status;
  let body: React.ReactNode;

  if (r.status === 'ready') {
    body = (
      <>
        <p className="eyebrow">Song {r.index + 1}</p>
        <p className="status-title">Get ready</p>
        <p className="muted">A song is about to play. Buzz the moment you know the next line.</p>
      </>
    );
  } else if (r.status === 'open') {
    body = (
      <>
        <p className="eyebrow">Buzzers are live</p>
        <p className="status-title" style={{ color: 'var(--teal)' }}>
          Listen…
        </p>
        <p className="muted">{lastWrong ? `${nameOf(players, lastWrong.playerId)} missed it. Anyone else? Buzz now!` : 'Know what comes next? Hit the buzzer.'}</p>
      </>
    );
  } else if (r.status === 'answering' && att) {
    const mine = att.playerId === meId;
    const p = byId(players, att.playerId);
    body = (
      <>
        <p className="eyebrow">{mine ? "It's your turn" : att.seq > 1 ? 'Next fastest' : 'Fastest finger'}</p>
        <p className="status-title" style={{ color: 'var(--bulb)' }}>
          {p ? `${p.avatar} ${p.displayName}` : 'Someone'}
        </p>
        <p style={{ fontWeight: 800 }}>{mine ? 'Unmute and sing the next line!' : 'Sing the next line!'}</p>
        <RingTimer runKey={`${r.key}-${att.seq}`} ms={ANSWER_MS} />
      </>
    );
    cls = 'answering';
  } else if (won) {
    body = (
      <>
        <p className="eyebrow">Nailed it</p>
        <p className="status-title" style={{ color: 'var(--teal)' }}>
          {byId(players, won.playerId)?.avatar} {nameOf(players, won.playerId)}
        </p>
        <p style={{ fontWeight: 800 }}>+{r.awarded?.pts ?? CORRECT_POINTS} points</p>
      </>
    );
    cls = 'won';
  } else {
    body = (
      <>
        <p className="eyebrow">Song {r.index + 1}</p>
        <p className="status-title" style={{ color: 'var(--coral)' }}>
          Nobody got it
        </p>
        <p className="muted">No points this song.</p>
      </>
    );
  }

  return (
    <div className={`status-board ${cls}`} style={{ ['--team' as string]: 'var(--bulb)' }} aria-live="polite">
      {body}
      {r.status === 'revealed' && r.reveal && (
        <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
          <p className="eyebrow">The line was</p>
          <p className="answer-line">{r.reveal.line || '…'}</p>
          {(r.reveal.title || r.reveal.artist) && (
            <p className="muted">
              {r.reveal.title}
              {r.reveal.artist ? ` · ${r.reveal.artist}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function BuzzList({ game, players, buzzes, limit = 8 }: { game: GameState; players: Player[]; buzzes: Buzz[]; limit?: number }) {
  const sorted = sortBuzzes(buzzes).filter(b => b.roundKey === game.round.key);
  const first = sorted[0] ? Date.parse(sorted[0].createdAt) : 0;
  const stateOf = (b: Buzz) => {
    const a = game.round.attempts.find(x => x.playerId === b.playerId);
    if (!a) return '';
    return a.result === 'pending' ? 'turn' : a.result;
  };
  return (
    <section className="card" aria-labelledby="buzz-title">
      <h3 id="buzz-title">Buzz order</h3>
      {sorted.length === 0 ? (
        <p className="muted">No buzzes yet.</p>
      ) : (
        <ol className="buzz-list">
          {sorted.slice(0, limit).map((b, i) => {
            const delta = (Date.parse(b.createdAt) - first) / 1000;
            return (
              <li key={b.id} className={stateOf(b)}>
                <span className="pos">{i + 1}</span>
                <span aria-hidden="true">{byId(players, b.playerId)?.avatar ?? '🎤'}</span>
                <span className="who">{nameOf(players, b.playerId)}</span>
                <span className="t">{i === 0 ? 'first' : `+${delta.toFixed(2)}s`}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Scoreboards                                                         */
/* ------------------------------------------------------------------ */

function rows(players: Player[], game: GameState, meId: string | undefined, fromZero: boolean): BoardRow[] {
  return players.map(p => ({
    id: p.id,
    label: p.displayName,
    avatar: p.avatar,
    color: p.id === meId ? 'var(--teal)' : 'var(--bulb)',
    from: fromZero ? 0 : game.points[p.id] ?? 0,
    to: game.points[p.id] ?? 0,
    highlight: p.id === meId,
  }));
}

/** Live scoreboard shown during the song rounds. Rows slide when points change. */
export function LiveBoard({ game, players, meId, limit = 5 }: { game: GameState; players: Player[]; meId?: string; limit?: number }) {
  const ranked = rankPlayers(players, game.points);
  const mine = ranked.find(r => r.player.id === meId);
  return (
    <section className="card" aria-labelledby="live-title">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 id="live-title">Live scoreboard</h3>
        {mine && <span className="chip">You: #{mine.rank} · {mine.points} pts</span>}
      </div>
      {players.length === 0 ? <p className="muted">No players yet.</p> : <AnimatedBoard rows={rows(players, game, meId, false)} rowHeight={54} limit={limit} />}
    </section>
  );
}

/** Final results: everyone counts up from zero and slides into place. */
export function FinalResults({ game, players, meId, big }: { game: GameState; players: Player[]; meId?: string; big?: boolean }) {
  const ranked = rankPlayers(players, game.points);
  const mine = ranked.find(r => r.player.id === meId);
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'end' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <p className="eyebrow">skribbl + Guess the line</p>
          <h2>Final results</h2>
        </div>
        {mine && (
          <span className="chip" style={{ fontSize: '0.9rem' }}>
            You are #{mine.rank} with {mine.points} pts
          </span>
        )}
      </div>
      <section className="card">
        {players.length === 0 ? <p className="muted">No players yet.</p> : <AnimatedBoard rows={rows(players, game, meId, true)} rowHeight={big ? 64 : 56} limit={big ? 10 : 15} />}
      </section>
    </div>
  );
}
