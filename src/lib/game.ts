import type { Attempt, Buzz, GameState, Player, RoundState, Song } from './types';
import { TRIAL_SONGS } from './songLists';

export const TOTAL_ROUNDS = 10;
export const ANSWER_MS = 5000;
/** Points for singing the right line. Doubled in the last round. */
export const CORRECT_POINTS = 2;
/** skribbl podium: 1st, 2nd, 3rd. */
export const PODIUM_POINTS = [3, 2, 1];

export const PHASE_LABEL: Record<GameState['phase'], string> = {
  lobby: 'Lobby',
  game1: 'skribbl',
  round: 'Guess the line',
  leaderboard: 'Results',
  wheel: 'Prize wheel',
};
export const PHASE_ORDER: GameState['phase'][] = ['lobby', 'game1', 'round', 'leaderboard', 'wheel'];

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
    game1: { name: 'skribbl.io', url: '', podium: [] },
    points: {},
    round: freshRound(0, TOTAL_ROUNDS, '1-start'),
    totalRounds: TOTAL_ROUNDS,
    winnerId: null,
    version: 0,
  };
}

export function isEmptyState(raw: unknown): boolean {
  return !raw || typeof raw !== 'object' || Object.keys(raw as object).length === 0;
}

const PHASES = new Set(PHASE_ORDER);

export function normalizeState(raw: unknown): GameState {
  const base = initialState();
  if (isEmptyState(raw)) return base;
  const r = raw as Partial<GameState> & { phase?: string };
  const round = { ...base.round, ...(r.round ?? {}) };
  round.attempts = (round.attempts ?? []).filter(a => a && typeof a.playerId === 'string');
  if (round.awarded && typeof (round.awarded as { playerId?: unknown }).playerId !== 'string') round.awarded = null;
  return {
    ...base,
    ...r,
    phase: PHASES.has(r.phase as GameState['phase']) ? (r.phase as GameState['phase']) : 'lobby',
    game1: { ...base.game1, ...(r.game1 ?? {}), podium: Array.isArray(r.game1?.podium) ? r.game1!.podium : [] },
    round,
    points: r.points ?? {},
    version: typeof r.version === 'number' ? r.version : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Phases                                                              */
/* ------------------------------------------------------------------ */

export function setPhase(s: GameState, phase: GameState['phase']): GameState {
  return { ...s, phase };
}

/* ------------------------------------------------------------------ */
/* Game 1: skribbl                                                     */
/* ------------------------------------------------------------------ */

export function setGame1Link(s: GameState, name: string, url: string): GameState {
  return { ...s, game1: { ...s.game1, name, url } };
}

/** Give +3/+2/+1. Saving again replaces the earlier podium instead of adding twice. */
export function setGame1Podium(s: GameState, podium: string[]): GameState {
  const points = { ...s.points };
  s.game1.podium.forEach((pid, i) => {
    if (pid) points[pid] = Math.max(0, (points[pid] ?? 0) - PODIUM_POINTS[i]);
  });
  const clean = podium.slice(0, 3);
  clean.forEach((pid, i) => {
    if (pid) points[pid] = (points[pid] ?? 0) + PODIUM_POINTS[i];
  });
  return { ...s, points, game1: { ...s.game1, podium: clean } };
}

/* ------------------------------------------------------------------ */
/* Guess the line                                                      */
/* ------------------------------------------------------------------ */

export function currentAttempt(r: RoundState): Attempt | null {
  const a = r.attempts[r.attempts.length - 1];
  return a && a.result === 'pending' ? a : null;
}

export function sortBuzzes(buzzes: Buzz[]): Buzz[] {
  return buzzes.slice().sort((x, y) => {
    const d = Date.parse(x.createdAt) - Date.parse(y.createdAt);
    if (d !== 0) return d;
    return Number(x.id) - Number(y.id) || (x.id < y.id ? -1 : 1);
  });
}

/** Fastest buzz from someone who hasn't had a turn yet this round. */
export function nextCandidate(s: GameState, buzzes: Buzz[]): Buzz | null {
  const tried = new Set(s.round.attempts.map(a => a.playerId));
  for (const b of sortBuzzes(buzzes)) {
    if (b.roundKey !== s.round.key || tried.has(b.playerId)) continue;
    return b;
  }
  return null;
}

/** Host pressed Play: buzzers go live. */
export function openBuzzers(s: GameState): GameState {
  if (s.phase === 'round' && s.round.status !== 'ready') return s;
  return { ...s, phase: 'round', round: { ...s.round, status: 'open' } };
}

/** Called when buzzes arrive. Returns null when nothing changes. */
export function startNextAttempt(s: GameState, buzzes: Buzz[]): GameState | null {
  if (s.phase !== 'round' || s.round.status !== 'open') return null;
  const b = nextCandidate(s, buzzes);
  if (!b) return null;
  const attempt: Attempt = { seq: s.round.attempts.length + 1, playerId: b.playerId, result: 'pending' };
  return { ...s, round: { ...s.round, status: 'answering', attempts: [...s.round.attempts, attempt] } };
}

/** Host judged the answer. Wrong passes the turn to the next fastest player. */
export function judge(s: GameState, correct: boolean, buzzes: Buzz[]): GameState {
  const a = currentAttempt(s.round);
  if (!a || s.round.status !== 'answering') return s;
  const attempts = s.round.attempts.map(x => (x.seq === a.seq ? ({ ...x, result: correct ? 'correct' : 'wrong' } as Attempt) : x));
  if (correct) {
    const pts = CORRECT_POINTS * (s.round.double ? 2 : 1);
    const points = { ...s.points, [a.playerId]: (s.points[a.playerId] ?? 0) + pts };
    return { ...s, points, round: { ...s.round, attempts, status: 'won', awarded: { playerId: a.playerId, pts } } };
  }
  const after: GameState = { ...s, round: { ...s.round, attempts, status: 'open' } };
  return startNextAttempt(after, buzzes) ?? after;
}

/** Host ends the round without a winner. */
export function closeRound(s: GameState): GameState {
  if (s.round.status === 'won' || s.round.status === 'failed' || s.round.status === 'revealed') return s;
  const attempts = s.round.attempts.map(x => (x.result === 'pending' ? ({ ...x, result: 'wrong' } as Attempt) : x));
  return { ...s, round: { ...s.round, attempts, status: 'failed' } };
}

export function revealAnswer(s: GameState, song: Song | undefined): GameState {
  const base = closeRound(s);
  return {
    ...base,
    round: { ...base.round, status: 'revealed', reveal: { title: song?.title ?? '', artist: song?.artist ?? '', line: song?.line ?? '' } },
  };
}

export function roundWinner(r: RoundState): Attempt | null {
  return r.attempts.find(a => a.result === 'correct') ?? null;
}

export function goToRound(s: GameState, index: number): GameState {
  const i = Math.max(0, Math.min(index, s.totalRounds - 1));
  return { ...s, phase: 'round', round: freshRound(i, s.totalRounds) };
}

/** Start the same round again and take back the points it gave. */
export function resetRound(s: GameState): GameState {
  const aw = s.round.awarded;
  const points = { ...s.points };
  if (aw) points[aw.playerId] = Math.max(0, (points[aw.playerId] ?? 0) - aw.pts);
  return { ...s, phase: 'round', points, round: freshRound(s.round.index, s.totalRounds) };
}

export function roundFinished(r: RoundState): boolean {
  return r.status === 'won' || r.status === 'failed' || r.status === 'revealed';
}

/* ------------------------------------------------------------------ */
/* Points and winner                                                   */
/* ------------------------------------------------------------------ */

export function adjustPoints(s: GameState, playerId: string, delta: number): GameState {
  return { ...s, points: { ...s.points, [playerId]: Math.max(0, (s.points[playerId] ?? 0) + delta) } };
}

export type Ranked = { player: Player; points: number; rank: number };

export function rankPlayers(players: Player[], points: Record<string, number>): Ranked[] {
  const sorted = players
    .map(p => ({ player: p, points: points[p.id] ?? 0 }))
    .sort((a, b) => b.points - a.points || a.player.displayName.localeCompare(b.player.displayName));
  let rank = 0;
  let last = Number.NaN;
  return sorted.map((r, i) => {
    if (r.points !== last) rank = i + 1;
    last = r.points;
    return { ...r, rank };
  });
}

export function crownWinner(s: GameState, playerId: string): GameState {
  return { ...s, phase: 'wheel', winnerId: playerId };
}

export function resetGame(s: GameState): GameState {
  const fresh = initialState();
  return { ...fresh, game1: { ...fresh.game1, name: s.game1.name || fresh.game1.name }, round: freshRound(0, fresh.totalRounds), version: s.version };
}

/* ------------------------------------------------------------------ */
/* Songs                                                               */
/* ------------------------------------------------------------------ */

export function placeholderSongs(): Song[] {
  return TRIAL_SONGS.map(s => ({ ...s }));
}

export function songReady(s: Song | undefined | null): boolean {
  return !!s && !!s.source.trim() && s.stop > s.start;
}
