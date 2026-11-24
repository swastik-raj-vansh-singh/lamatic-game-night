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
 * answering – one player has their 7 seconds
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

/** What players' devices need to play the clip: the link and timing, never the answer. */
export type Clip = { source: string; start: number; stop: number };

/** The host's latest play/pause command. Each new command has a higher `seq`. */
export type Playback = { status: 'playing' | 'paused' | 'stopped'; from: number; until: number | null; seq: number };

export type RoundState = {
  index: number;
  key: string;
  status: RoundStatus;
  attempts: Attempt[];
  reveal: { title: string; artist: string; line: string } | null;
  double: boolean;
  awarded: { playerId: string; pts: number } | null;
  clip: Clip | null;
  playback: Playback | null;
};

export type GameState = {
  phase: Phase;
  game1: { name: string; url: string; podium: string[] };
  points: Record<string, number>;
  round: RoundState;
  totalRounds: number;
  winnerId: string | null;
  /** Play the songs on every player's own device (true) or only on the Stage (false). */
  playOnDevices: boolean;
  /** Which one-time song list upgrades have been applied (see songLists.ts). */
  songListVersion: number;
  /** Accounts that opened the Stage or Answer sheet. They run the game and are hidden from player lists. */
  hostIds: string[];
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

/** The latest spin. `attempt` is 1 for the first spin, 2 for the second. */
export type WheelSpin = { segment: number; spunBy: string; spunAt: string; attempt: number } | null;
