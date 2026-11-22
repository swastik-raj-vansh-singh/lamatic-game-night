import type { AuthUser, Buzz, GameState, Player, Song, WheelSpin } from '../types';

export type Result = { error?: string };
export type Unsubscribe = () => void;

export type RoundLog = {
  round: number;
  roundKey: string;
  outcome: 'won' | 'failed';
  team: string | null;
  answeredBy: string | null;
  points: Record<string, number>;
};

export interface Backend {
  mode: 'demo' | 'supabase';

  // Auth
  getUser(): Promise<AuthUser | null>;
  onAuthChange(cb: (u: AuthUser | null) => void): Unsubscribe;
  signInWithGoogle(next: string): Promise<Result>;
  signInWithEmail(email: string, next: string): Promise<Result>;
  signInDemo?(email: string, asHost: boolean): Promise<Result>;
  signOut(): Promise<void>;
  isHost(): Promise<boolean>;

  // Players
  playerCount(): Promise<number | null>;
  fetchPlayers(): Promise<Player[]>;
  upsertMe(name: string, avatar: string): Promise<Result>;
  removePlayer(id: string): Promise<Result>;
  subscribePlayers(cb: () => void): Unsubscribe;

  // Game state (host writes, everyone reads)
  fetchState(): Promise<unknown>;
  writeState(s: GameState): Promise<Result>;
  subscribeState(cb: (raw: unknown) => void): Unsubscribe;

  // Buzzers
  fetchBuzzes(roundKey: string): Promise<Buzz[]>;
  subscribeBuzzes(roundKey: string, cb: () => void): Unsubscribe;
  buzz(roundKey: string, reactionMs: number): Promise<Result & { already?: boolean }>;
  clearBuzzes(): Promise<Result>;

  // Songs (host only)
  fetchSongs(): Promise<Song[]>;
  saveSongs(songs: Song[]): Promise<Result>;

  // Wheel
  fetchWheel(): Promise<WheelSpin>;
  subscribeWheel(cb: () => void): Unsubscribe;
  spin(): Promise<Result & { segment?: number }>;
  resetWheel(): Promise<Result>;

  // History
  logRound(r: RoundLog): Promise<void>;

  // Demo helpers
  addBots?(n: number): Promise<void>;
  botBuzz?(roundKey: string, playerId: string, reactionMs: number): Promise<void>;
  resetDemo?(): Promise<void>;
}
