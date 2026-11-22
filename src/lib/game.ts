import type { Attempt, Buzz, GameState, Player, RoundState, Song, TeamId } from './types';
import { TEAM_IDS } from './types';

export const TOTAL_ROUNDS = 10;
export const ANSWER_MS = 5000;
/** Team score for a correct line. Doubled in the last round. */
export const TEAM_WIN_POINTS = 100;
/** The player who sings the line. */
export const ANSWERER_POINTS = 2;
/** Everyone else on the winning team. */
export const TEAMMATE_POINTS = 1;

export const TEAM_LABEL: Record<TeamId, string> = { A: 'Team A', B: 'Team B', C: 'Team C', D: 'Team D' };

function randomInt(n: number): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

export function randomId(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) s += randomInt(36).toString(36);
  return s;
}

export function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** About five people per team: 10 → 2 teams, 14/15/16 → 3 teams, 20 → 4 teams. */
export function suggestTeamCount(players: number): number {
  if (players < 4) return Math.max(1, Math.min(players, 2));
  return Math.max(2, Math.min(4, Math.round(players / 5)));
}

/** Random, balanced teams: sizes never differ by more than one. */
export function makeTeams(playerIds: string[], count: number): Record<string, TeamId> {
  const ids = TEAM_IDS.slice(0, Math.max(1, Math.min(count, TEAM_IDS.length)));
  const out: Record<string, TeamId> = {};
  shuffle(playerIds).forEach((pid, i) => {
    out[pid] = ids[i % ids.length];
  });
  return out;
}

export function freshRound(index: number, total: number, key?: string): RoundState {
  return {
    index,
    key: key ?? `${index + 1}-${randomId()}`,
    status: 'ready',
    attempts: [],
    reveal: null,
    double: index === total - 1,
    awarded: null,
  };
}

export function initialState(): GameState {
  return {
    phase: 'lobby',
    game1: { name: '', url: '' },
    teamCount: 3,
    teams: {},
    teamScores: {},
    points: {},
    board: { prevPoints: {}, prevTeamScores: {}, shownAt: 0 },
    round: freshRound(0, TOTAL_ROUNDS, '1-start'),
    totalRounds: TOTAL_ROUNDS,
    winnerId: null,
    version: 0,
  };
}

export function isEmptyState(raw: unknown): boolean {
  return !raw || typeof raw !== 'object' || Object.keys(raw as object).length === 0;
}

export function normalizeState(raw: unknown): GameState {
  const base = initialState();
  if (isEmptyState(raw)) return base;
  const r = raw as Partial<GameState>;
  return {
    ...base,
    ...r,
    game1: { ...base.game1, ...(r.game1 ?? {}) },
    board: { ...base.board, ...(r.board ?? {}) },
    round: { ...base.round, ...(r.round ?? {}) },
    teams: r.teams ?? {},
    teamScores: r.teamScores ?? {},
    points: r.points ?? {},
  };
}

const bump = (s: GameState): GameState => ({ ...s, version: (s.version ?? 0) + 1 });

/* ------------------------------------------------------------------ */
/* Teams                                                               */
/* ------------------------------------------------------------------ */

export function activeTeams(s: GameState): TeamId[] {
  const used = new Set(Object.values(s.teams));
  return TEAM_IDS.slice(0, s.teamCount).filter(t => used.has(t));
}

export function teamMembers(s: GameState, players: Player[], team: TeamId): Player[] {
  return players.filter(p => s.teams[p.id] === team);
}

export function assignTeams(s: GameState, players: Player[], count: number): GameState {
  const teams = makeTeams(players.map(p => p.id), count);
  return bump({ ...s, phase: 'teams', teamCount: count, teams, teamScores: {} });
}

/* ------------------------------------------------------------------ */
/* Rounds                                                              */
/* ------------------------------------------------------------------ */

export function currentAttempt(r: RoundState): Attempt | null {
  const a = r.attempts[r.attempts.length - 1];
  return a && a.result === 'pending' ? a : null;
}

export function triedTeams(r: RoundState): Set<TeamId> {
  return new Set(r.attempts.map(a => a.team));
}

export function sortBuzzes(buzzes: Buzz[]): Buzz[] {
  return buzzes.slice().sort((x, y) => {
    const d = Date.parse(x.createdAt) - Date.parse(y.createdAt);
    if (d !== 0) return d;
    return Number(x.id) - Number(y.id) || (x.id < y.id ? -1 : 1);
  });
}

/** Fastest buzz from a team that hasn't had its turn yet. */
export function nextCandidate(s: GameState, buzzes: Buzz[]): Buzz | null {
  const tried = triedTeams(s.round);
  for (const b of sortBuzzes(buzzes)) {
    if (b.roundKey !== s.round.key) continue;
    const team = s.teams[b.playerId];
    if (!team || tried.has(team)) continue;
    return b;
  }
  return null;
}

/** Host pressed Play: buzzers go live. */
export function openBuzzers(s: GameState): GameState {
  if (s.phase === 'round' && s.round.status !== 'ready') return s;
  return bump({ ...s, phase: 'round', round: { ...s.round, status: 'open' } });
}

/** Called by the stage when buzzes arrive. Returns null when nothing changes. */
export function startNextAttempt(s: GameState, buzzes: Buzz[]): GameState | null {
  if (s.phase !== 'round' || s.round.status !== 'open') return null;
  const b = nextCandidate(s, buzzes);
  if (!b) return null;
  const team = s.teams[b.playerId] as TeamId;
  const attempt: Attempt = { seq: s.round.attempts.length + 1, team, playerId: b.playerId, result: 'pending' };
  return bump({ ...s, round: { ...s.round, status: 'answering', attempts: [...s.round.attempts, attempt] } });
}

/** Host judged the answer. Wrong passes the turn to the next fastest team. */
export function judge(s: GameState, correct: boolean, buzzes: Buzz[]): GameState {
  const a = currentAttempt(s.round);
  if (!a || s.round.status !== 'answering') return s;
  const attempts = s.round.attempts.map(x =>
    x.seq === a.seq ? { ...x, result: correct ? 'correct' : 'wrong' } as Attempt : x,
  );

  if (correct) {
    const mult = s.round.double ? 2 : 1;
    const award: Record<string, number> = {};
    for (const [pid, t] of Object.entries(s.teams)) {
      if (t === a.team) award[pid] = (pid === a.playerId ? ANSWERER_POINTS : TEAMMATE_POINTS) * mult;
    }
    const points = { ...s.points };
    for (const [pid, v] of Object.entries(award)) points[pid] = (points[pid] ?? 0) + v;
    const teamPts = TEAM_WIN_POINTS * mult;
    const teamScores = { ...s.teamScores, [a.team]: (s.teamScores[a.team] ?? 0) + teamPts };
    return bump({
      ...s,
      points,
      teamScores,
      round: { ...s.round, attempts, status: 'won', awarded: { points: award, team: a.team, teamPts } },
    });
  }

  const after: GameState = { ...s, round: { ...s.round, attempts, status: 'open' } };
  if (triedTeams(after.round).size >= activeTeams(s).length) {
    return bump({ ...after, round: { ...after.round, status: 'failed' } });
  }
  return startNextAttempt(after, buzzes) ?? bump(after);
}

/** Host ends the round without a winner (e.g. nobody buzzed). */
export function closeRound(s: GameState): GameState {
  if (s.round.status === 'won' || s.round.status === 'failed' || s.round.status === 'revealed') return s;
  const attempts = s.round.attempts.map(x => (x.result === 'pending' ? { ...x, result: 'wrong' } as Attempt : x));
  return bump({ ...s, round: { ...s.round, attempts, status: 'failed' } });
}

export function revealAnswer(s: GameState, song: Song | undefined): GameState {
  const base = s.round.status === 'answering' || s.round.status === 'open' || s.round.status === 'ready' ? closeRound(s) : s;
  return bump({
    ...base,
    round: {
      ...base.round,
      status: 'revealed',
      reveal: { title: song?.title ?? '', artist: song?.artist ?? '', line: song?.line ?? '' },
    },
  });
}

export function roundWinner(r: RoundState): Attempt | null {
  return r.attempts.find(a => a.result === 'correct') ?? null;
}

export function goToRound(s: GameState, index: number): GameState {
  const i = Math.max(0, Math.min(index, s.totalRounds - 1));
  return bump({ ...s, phase: 'round', round: freshRound(i, s.totalRounds) });
}

/** Start the same round again and take back any points it gave. */
export function resetRound(s: GameState): GameState {
  let points = s.points;
  let teamScores = s.teamScores;
  const aw = s.round.awarded;
  if (aw) {
    points = { ...points };
    for (const [pid, v] of Object.entries(aw.points)) points[pid] = Math.max(0, (points[pid] ?? 0) - v);
    teamScores = { ...teamScores, [aw.team]: Math.max(0, (teamScores[aw.team] ?? 0) - aw.teamPts) };
  }
  return bump({ ...s, phase: 'round', points, teamScores, round: freshRound(s.round.index, s.totalRounds) });
}

/* ------------------------------------------------------------------ */
/* Points, leaderboard, winner                                         */
/* ------------------------------------------------------------------ */

export function adjustPoints(s: GameState, playerId: string, delta: number): GameState {
  const points = { ...s.points, [playerId]: Math.max(0, (s.points[playerId] ?? 0) + delta) };
  return bump({ ...s, points });
}

export function setPhase(s: GameState, phase: GameState['phase']): GameState {
  return bump({ ...s, phase });
}

/** Snapshot the last board so the next one can animate from it. */
export function showLeaderboard(s: GameState): GameState {
  if (s.phase === 'leaderboard') return s;
  return bump({ ...s, phase: 'leaderboard' });
}

/** Called when leaving the leaderboard: remember these scores as the next "before". */
export function rememberBoard(s: GameState): GameState {
  return { ...s, board: { prevPoints: { ...s.points }, prevTeamScores: { ...s.teamScores }, shownAt: Date.now() } };
}

export type Ranked = { player: Player; points: number; rank: number };

export function rankPlayers(players: Player[], points: Record<string, number>): Ranked[] {
  return players
    .map(p => ({ player: p, points: points[p.id] ?? 0 }))
    .sort((a, b) => b.points - a.points || a.player.displayName.localeCompare(b.player.displayName))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function crownWinner(s: GameState, playerId: string): GameState {
  return bump({ ...s, phase: 'wheel', winnerId: playerId });
}

export function resetGame(s: GameState): GameState {
  const fresh = initialState();
  return { ...fresh, game1: s.game1, round: freshRound(0, fresh.totalRounds), version: (s.version ?? 0) + 1 };
}

/* ------------------------------------------------------------------ */
/* Placeholder songs                                                   */
/* ------------------------------------------------------------------ */

export function placeholderSongs(): Song[] {
  return Array.from({ length: TOTAL_ROUNDS }, (_, i) => ({
    round: i + 1,
    title: `Song ${i + 1} title`,
    artist: 'Artist name',
    source: '/songs/demo-tune.wav',
    start: (i % 3) * 2,
    stop: (i % 3) * 2 + 6,
    line: `Correct next line for round ${i + 1} goes here`,
  }));
}
