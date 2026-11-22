export type AuthUser = { id: string; email: string };

export type Player = {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
  joinedAt: string;
  isBot?: boolean;
};

/**
 * lobby       – people join and pick a name
 * game1       – skribbl: everyone gets the room link, host gives +3/+2/+1 after
 * round       – Guess the line: song rounds with buzzers
 * leaderboard – final results
 * wheel       – the winner spins for a prize
 */
export type Phase = 'lobby' | 'game1' | 'round' | 'leaderboard' | 'wheel';

/**
 * ready     – round set up, waiting for the host to press Play
 * open      – song is playing / buzzers are live, nobody is answering
 * answering – one player has their 5 seconds
 * won       – someone sang the right line
 * failed    – the host closed the round without a winner
 * revealed  – the host showed the correct line to everyone
 */
export type RoundStatus = 'ready' | 'open' | 'answering' | 'won' | 'failed' | 'revealed';

export type Attempt = {
  seq: number;
  playerId: string;
  result: 'pending' | 'correct' | 'wrong';
};

export type RoundState = {
  index: number;
  key: string;
  status: RoundStatus;
  attempts: Attempt[];
  reveal: { title: string; artist: string; line: string } | null;
  double: boolean;
  awarded: { playerId: string; pts: number } | null;
};

export type GameState = {
  phase: Phase;
  game1: { name: string; url: string; podium: string[] };
  points: Record<string, number>;
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
