export type TeamId = 'A' | 'B' | 'C' | 'D';
export const TEAM_IDS: TeamId[] = ['A', 'B', 'C', 'D'];

export type AuthUser = { id: string; email: string };

export type Player = {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
  joinedAt: string;
  isBot?: boolean;
};

export type Phase = 'lobby' | 'game1' | 'teams' | 'round' | 'leaderboard' | 'wheel';

/**
 * ready     – round set up, waiting for the host to press Play
 * open      – song is playing / buzzers are live, nobody is answering
 * answering – a team has its 5 seconds
 * won       – a team sang the right line
 * failed    – every team missed (or the host closed the round)
 * revealed  – the host showed the correct line to everyone
 */
export type RoundStatus = 'ready' | 'open' | 'answering' | 'won' | 'failed' | 'revealed';

export type Attempt = {
  seq: number;
  team: TeamId;
  playerId: string;
  result: 'pending' | 'correct' | 'wrong';
};

export type RoundAward = {
  points: Record<string, number>;
  team: TeamId;
  teamPts: number;
};

export type RoundState = {
  index: number;
  key: string;
  status: RoundStatus;
  attempts: Attempt[];
  reveal: { title: string; artist: string; line: string } | null;
  double: boolean;
  awarded: RoundAward | null;
};

export type Board = {
  prevPoints: Record<string, number>;
  prevTeamScores: Partial<Record<TeamId, number>>;
  shownAt: number;
};

export type GameState = {
  phase: Phase;
  game1: { name: string; url: string };
  teamCount: number;
  teams: Record<string, TeamId>;
  teamScores: Partial<Record<TeamId, number>>;
  points: Record<string, number>;
  board: Board;
  round: RoundState;
  totalRounds: number;
  winnerId: string | null;
  version: number;
};

export type Buzz = {
  id: string;
  roundKey: string;
  playerId: string;
  reactionMs: number | null;
  createdAt: string;
};

export type Song = {
  round: number;
  title: string;
  artist: string;
  source: string;
  start: number;
  stop: number;
  line: string;
};

export type WheelSpin = { segment: number; spunBy: string; spunAt: string } | null;
