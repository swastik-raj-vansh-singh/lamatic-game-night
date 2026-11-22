'use client';

import { useEffect, useMemo, useState } from 'react';
import { ANSWER_MS, TEAM_LABEL, activeTeams, currentAttempt, rankPlayers, roundWinner, sortBuzzes, teamMembers } from '@/lib/game';
import type { Buzz, GameState, Player, TeamId } from '@/lib/types';
import { TEAM_IDS } from '@/lib/types';
import { AnimatedBoard, type BoardRow } from './AnimatedBoard';
import { RingTimer } from './RingTimer';
import { TeamChip, teamStyle } from './ui';

const nameOf = (players: Player[], id: string | null | undefined) => players.find(p => p.id === id)?.displayName ?? 'Someone';

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
/* Game 1: drawing game (link set by the host)                          */
/* ------------------------------------------------------------------ */

export function Game1View({ game }: { game: GameState }) {
  const { name, url } = game.game1;
  return (
    <section className="card" style={{ textAlign: 'center', justifyItems: 'center', gap: 16, padding: '34px 22px' }}>
      <p className="eyebrow">Game 1 · Drawing</p>
      <h2 style={{ fontSize: 'clamp(2rem, 6vw, 3.6rem)', color: 'var(--bulb)' }}>{name || 'Draw it. Guess it.'}</h2>
      <p className="lede muted">
        {name ? 'Join the room, draw badly, guess fast.' : 'The host is picking the drawing game. The join link shows up here.'}
      </p>
      {url ? (
        <a className="btn big" href={url} target="_blank" rel="noopener noreferrer">
          Join {name || 'the game'}
        </a>
      ) : (
        <span className="chip">Link coming soon</span>
      )}
      <p className="muted">Top 3 get points for the final leaderboard: +3, +2 and +1.</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Teams reveal                                                        */
/* ------------------------------------------------------------------ */

export function TeamsView({ game, players, meId }: { game: GameState; players: Player[]; meId?: string }) {
  const sig = useMemo(() => JSON.stringify(game.teams), [game.teams]);
  const [shuffling, setShuffling] = useState(true);
  const [flash, setFlash] = useState('');
  const teams = activeTeams(game);
  const myTeam = meId ? game.teams[meId] : undefined;

  useEffect(() => {
    if (!Object.keys(game.teams).length) return;
    setShuffling(true);
    const names = players.map(p => p.displayName);
    const iv = setInterval(() => setFlash(names[Math.floor(Math.random() * names.length)] ?? ''), 90);
    const t = setTimeout(() => {
      clearInterval(iv);
      setShuffling(false);
    }, 1800);
    return () => {
      clearInterval(iv);
      clearTimeout(t);
    };
    // Replay only when the assignment changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  if (!teams.length) {
    return (
      <div className="shuffle-box">
        <p className="muted">The host is about to shuffle the teams.</p>
      </div>
    );
  }
  if (shuffling) {
    return (
      <div className="shuffle-box" aria-live="polite">
        <p className="eyebrow">Shuffling teams</p>
        <p className="shuffle-name">{flash}</p>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {myTeam && (
        <div className="card" style={{ ...teamStyle(myTeam), textAlign: 'center', justifyItems: 'center', borderColor: 'var(--team)' }}>
          <p className="eyebrow">You are on</p>
          <p className="your-team">{TEAM_LABEL[myTeam]}</p>
        </div>
      )}
      <div className="teams-grid">
        {teams.map((t, ti) => (
          <div key={t} className={`team-col${t === myTeam ? ' mine' : ''}`} style={teamStyle(t)}>
            <h3>{TEAM_LABEL[t]}</h3>
            {teamMembers(game, players, t).map((p, i) => (
              <span key={p.id} className={`name-chip${p.id === meId ? ' me' : ''}`} style={{ animationDelay: `${(ti * 2 + i) * 110}ms` }}>
                <span className="avatar" aria-hidden="true">
                  {p.avatar}
                </span>
                <span>{p.displayName}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Round status: who is answering, the 5-second clock, results          */
/* ------------------------------------------------------------------ */

export function RoundStatusBoard({ game, players, meId, onTimeUp }: { game: GameState; players: Player[]; meId?: string; onTimeUp?: () => void }) {
  const r = game.round;
  const att = currentAttempt(r);
  const won = roundWinner(r);
  const myTeam = meId ? game.teams[meId] : undefined;
  const lastWrong = r.attempts.filter(a => a.result === 'wrong').at(-1);

  let cls = r.status;
  let team: TeamId | undefined;
  let body: React.ReactNode;

  if (r.status === 'ready') {
    body = (
      <>
        <p className="eyebrow">Round {r.index + 1}</p>
        <p className="status-title">Get ready</p>
        <p className="muted">The host is about to play a song. Buzz the moment you know the next line.</p>
      </>
    );
  } else if (r.status === 'open') {
    body = (
      <>
        <p className="eyebrow">Buzzers are live</p>
        <p className="status-title" style={{ color: 'var(--teal)' }}>
          Listen…
        </p>
        <p className="muted">
          {lastWrong ? `${TEAM_LABEL[lastWrong.team]} missed it. Other teams, buzz now!` : 'Know what comes next? Hit the buzzer.'}
        </p>
      </>
    );
  } else if (r.status === 'answering' && att) {
    team = att.team;
    const mine = myTeam === att.team;
    body = (
      <>
        <p className="eyebrow">{mine ? "It's your team's turn" : 'Now answering'}</p>
        <p className="status-title team">{TEAM_LABEL[att.team]}</p>
        <p style={{ fontWeight: 800 }}>
          {att.seq > 1 ? `${nameOf(players, att.playerId)} steals the turn!` : `${nameOf(players, att.playerId)} buzzed first.`} Sing the next line!
        </p>
        <RingTimer runKey={`${r.key}-${att.seq}`} ms={ANSWER_MS} onEnd={onTimeUp} />
      </>
    );
  } else if (r.status === 'won' || (r.status === 'revealed' && won)) {
    team = won?.team;
    body = (
      <>
        <p className="eyebrow">Nailed it</p>
        <p className="status-title team">{won ? TEAM_LABEL[won.team] : ''}</p>
        <p style={{ fontWeight: 800 }}>
          {won ? `${nameOf(players, won.playerId)} +${r.awarded?.points[won.playerId] ?? 2}, teammates +${r.double ? 2 : 1} each` : ''}
        </p>
      </>
    );
    cls = 'won';
  } else {
    body = (
      <>
        <p className="eyebrow">Round {r.index + 1}</p>
        <p className="status-title" style={{ color: 'var(--coral)' }}>
          Nobody got it
        </p>
        <p className="muted">No points this round.</p>
      </>
    );
  }

  return (
    <div className={`status-board ${cls}`} style={teamStyle(team)} aria-live="polite">
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

export function RoundHeader({ game }: { game: GameState }) {
  return (
    <div className="round-head">
      <strong>
        Round {game.round.index + 1} of {game.totalRounds}
      </strong>
      {game.round.double && <span className="chip double">Double points</span>}
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
            const team = game.teams[b.playerId];
            const delta = (Date.parse(b.createdAt) - first) / 1000;
            return (
              <li key={b.id} className={stateOf(b)}>
                <span className="pos">{i + 1}</span>
                <TeamChip team={team} />
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
/* Leaderboard                                                         */
/* ------------------------------------------------------------------ */

export function LeaderboardView({ game, players, meId, big }: { game: GameState; players: Player[]; meId?: string; big?: boolean }) {
  const teams = activeTeams(game);
  const teamRows: BoardRow[] = teams.map(t => ({
    id: t,
    label: TEAM_LABEL[t],
    color: `var(--team-${t})`,
    from: game.board.prevTeamScores[t] ?? 0,
    to: game.teamScores[t] ?? 0,
  }));
  const playerRows: BoardRow[] = players.map(p => ({
    id: p.id,
    label: p.displayName,
    avatar: p.avatar,
    color: game.teams[p.id] ? `var(--team-${game.teams[p.id]})` : 'var(--bulb)',
    from: game.board.prevPoints[p.id] ?? 0,
    to: game.points[p.id] ?? 0,
    highlight: p.id === meId,
    tag: <TeamChip team={game.teams[p.id]} />,
  }));
  const ranked = rankPlayers(players, game.points);
  const mine = ranked.find(r => r.player.id === meId);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'end' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <p className="eyebrow">Live standings</p>
          <h2>Leaderboard</h2>
        </div>
        {mine && (
          <span className="chip" style={{ fontSize: '0.9rem' }}>
            You are #{mine.rank} with {mine.points} pts
          </span>
        )}
      </div>
      <div className="board-split">
        {teamRows.length > 0 && (
          <section className="card">
            <h3>Teams</h3>
            <AnimatedBoard rows={teamRows} rowHeight={big ? 76 : 64} />
          </section>
        )}
        <section className="card" style={teamRows.length ? undefined : { gridColumn: '1 / -1' }}>
          <h3>Players</h3>
          <AnimatedBoard rows={playerRows} rowHeight={big ? 62 : 56} limit={big ? 8 : 10} />
        </section>
      </div>
    </div>
  );
}

export function teamOrder(game: GameState): TeamId[] {
  return TEAM_IDS.filter(t => activeTeams(game).includes(t)).sort((a, b) => (game.teamScores[b] ?? 0) - (game.teamScores[a] ?? 0));
}
