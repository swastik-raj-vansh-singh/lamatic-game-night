'use client';

import { AVATARS, isValidEmail } from '../config';
import { placeholderSongs, randomId } from '../game';
import type { AuthUser, Buzz, GameState, Player, Song, WheelSpin } from '../types';
import type { Backend, Result, RoundLog, Unsubscribe } from './types';

/**
 * Demo backend: everything lives in this browser's localStorage, and every
 * open tab stays in sync through BroadcastChannel. Each tab is its own
 * signed-in person (identity is kept in sessionStorage), so you can open a
 * few tabs to try the buzzers against each other.
 */

const DB_KEY = 'gn-demo-db-v1';
const ME_KEY = 'gn-demo-me';
/** The demo host is remembered across tabs, so the Stage and Host console open signed in. */
const HOST_KEY = 'gn-demo-host';

type Me = AuthUser & { host: boolean };
type DemoDB = {
  players: Player[];
  state: unknown;
  buzzes: Buzz[];
  songs: Song[];
  wheel: WheelSpin;
  results: RoundLog[];
  seq: number;
};

const emptyDb = (): DemoDB => ({ players: [], state: {}, buzzes: [], songs: placeholderSongs(), wheel: null, results: [], seq: 1 });

const BOT_NAMES = ['Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Isha', 'Vikram', 'Ananya', 'Arjun', 'Tara', 'Neel', 'Sana', 'Dev', 'Zoya', 'Kiran', 'Riya'];

class DemoBackend implements Backend {
  mode = 'demo' as const;
  private listeners = new Set<() => void>();
  private authListeners = new Set<(u: AuthUser | null) => void>();
  private bc: BroadcastChannel | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel('gn-demo');
      this.bc.onmessage = () => this.emit();
    } else {
      window.addEventListener('storage', e => {
        if (e.key === DB_KEY) this.emit();
      });
    }
  }

  private read(): DemoDB {
    try {
      const v = localStorage.getItem(DB_KEY);
      if (v) return { ...emptyDb(), ...JSON.parse(v) };
    } catch {
      /* fall through */
    }
    return emptyDb();
  }

  private write(db: DemoDB) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      /* storage full or blocked */
    }
    this.bc?.postMessage('change');
    this.emit();
  }

  private emit() {
    this.listeners.forEach(l => l());
  }

  private listen(cb: () => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private me(): Me | null {
    try {
      const v = sessionStorage.getItem(ME_KEY);
      if (v) return JSON.parse(v) as Me;
      const onHostPage = /^\/(stage|host)/.test(window.location.pathname);
      const h = onHostPage ? localStorage.getItem(HOST_KEY) : null;
      if (h) {
        sessionStorage.setItem(ME_KEY, h);
        return JSON.parse(h) as Me;
      }
      return null;
    } catch {
      return null;
    }
  }

  async getUser() {
    const m = this.me();
    return m ? { id: m.id, email: m.email } : null;
  }

  onAuthChange(cb: (u: AuthUser | null) => void): Unsubscribe {
    this.authListeners.add(cb);
    return () => this.authListeners.delete(cb);
  }

  async signInWithGoogle(): Promise<Result> {
    return { error: 'Google sign-in needs Supabase. Use the demo sign-in below.' };
  }

  async signInWithEmail(): Promise<Result> {
    return { error: 'Email links need Supabase. Use the demo sign-in below.' };
  }

  async signInDemo(email: string, asHost: boolean): Promise<Result> {
    if (!isValidEmail(email)) return { error: 'Enter a valid email address.' };
    const clean = email.trim().toLowerCase();
    const existing = this.read().players.find(p => p.email === clean);
    const me: Me = { id: existing?.id ?? `demo-${randomId(8)}`, email: clean, host: asHost };
    try {
      sessionStorage.setItem(ME_KEY, JSON.stringify(me));
      if (asHost) localStorage.setItem(HOST_KEY, JSON.stringify(me));
    } catch {
      return { error: 'This browser blocks storage, so demo mode cannot sign you in.' };
    }
    this.authListeners.forEach(l => l({ id: me.id, email: me.email }));
    return {};
  }

  async signOut() {
    try {
      const m = this.me();
      sessionStorage.removeItem(ME_KEY);
      if (m?.host) localStorage.removeItem(HOST_KEY);
    } catch {
      /* ignore */
    }
    this.authListeners.forEach(l => l(null));
  }

  async isHost() {
    return !!this.me()?.host;
  }

  async playerCount() {
    return this.read().players.length;
  }

  async fetchPlayers() {
    return this.read().players.slice().sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  }

  async upsertMe(name: string, avatar: string): Promise<Result> {
    const me = this.me();
    if (!me) return { error: 'Sign in first.' };
    const db = this.read();
    const i = db.players.findIndex(p => p.id === me.id);
    const row: Player = {
      id: me.id,
      email: me.email,
      displayName: name.trim().slice(0, 24),
      avatar,
      joinedAt: i >= 0 ? db.players[i].joinedAt : new Date().toISOString(),
    };
    if (i >= 0) db.players[i] = row;
    else db.players.push(row);
    this.write(db);
    return {};
  }

  async removePlayer(id: string): Promise<Result> {
    const db = this.read();
    db.players = db.players.filter(p => p.id !== id);
    this.write(db);
    return {};
  }

  subscribePlayers(cb: () => void) {
    return this.listen(cb);
  }

  async fetchState() {
    return this.read().state;
  }

  async writeState(s: GameState, expectedVersion: number | null) {
    if (!this.me()?.host) return { error: 'Only the host can change the game.' };
    const db = this.read();
    const stored = (db.state as Partial<GameState>)?.version;
    if (expectedVersion !== null && (stored ?? 0) !== expectedVersion) return { conflict: true };
    db.state = s;
    this.write(db);
    return {};
  }

  subscribeState(cb: (raw: unknown) => void) {
    return this.listen(() => cb(this.read().state));
  }

  async fetchBuzzes(roundKey: string) {
    return this.read().buzzes.filter(b => b.roundKey === roundKey);
  }

  subscribeBuzzes(_roundKey: string, cb: () => void) {
    return this.listen(cb);
  }

  private insertBuzz(roundKey: string, playerId: string, reactionMs: number): Result & { already?: boolean } {
    const db = this.read();
    const s = db.state as Partial<GameState>;
    if (s?.phase !== 'round' || s.round?.key !== roundKey || !['open', 'answering'].includes(s.round?.status ?? '')) {
      return { error: 'Buzzers are closed.' };
    }
    if (db.buzzes.some(b => b.roundKey === roundKey && b.playerId === playerId)) return { already: true };
    db.buzzes.push({ id: String(db.seq++), roundKey, playerId, reactionMs, createdAt: new Date().toISOString() });
    this.write(db);
    return {};
  }

  async buzz(roundKey: string, reactionMs: number) {
    const me = this.me();
    if (!me) return { error: 'Sign in first.' };
    return this.insertBuzz(roundKey, me.id, reactionMs);
  }

  async botBuzz(roundKey: string, playerId: string, reactionMs: number) {
    this.insertBuzz(roundKey, playerId, reactionMs);
  }

  async clearBuzzes(): Promise<Result> {
    const db = this.read();
    db.buzzes = [];
    this.write(db);
    return {};
  }

  async fetchSongs() {
    return this.read().songs;
  }

  async saveSongs(songs: Song[]): Promise<Result> {
    if (!this.me()?.host) return { error: 'Only the host can edit songs.' };
    const db = this.read();
    db.songs = songs;
    this.write(db);
    return {};
  }

  async fetchWheel() {
    return this.read().wheel;
  }

  subscribeWheel(cb: () => void) {
    return this.listen(cb);
  }

  async spin(): Promise<Result & { segment?: number }> {
    const me = this.me();
    const db = this.read();
    const s = db.state as Partial<GameState>;
    if (s?.phase !== 'wheel') return { error: 'The wheel is not open yet.' };
    if (!s.winnerId) return { error: 'Pick a winner first.' };
    if (!me || (s.winnerId !== me.id && !me.host)) return { error: 'Only the winner or the host can spin the wheel.' };
    if (db.wheel) return { error: 'The wheel has already been spun.' };
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    const segment = a[0] % 5;
    db.wheel = { segment, spunBy: me.id, spunAt: new Date().toISOString() };
    this.write(db);
    return { segment };
  }

  async resetWheel(): Promise<Result> {
    const db = this.read();
    db.wheel = null;
    this.write(db);
    return {};
  }

  async logRound(r: RoundLog) {
    const db = this.read();
    db.results = [...db.results.filter(x => x.roundKey !== r.roundKey), r];
    this.write(db);
  }

  async addBots(n: number) {
    const db = this.read();
    const taken = new Set(db.players.map(p => p.displayName));
    let added = 0;
    for (const name of BOT_NAMES) {
      if (added >= n) break;
      const display = `${name} (test)`;
      if (taken.has(display)) continue;
      db.players.push({
        id: `bot-${randomId(8)}`,
        email: `${name.toLowerCase()}@example.com`,
        displayName: display,
        avatar: AVATARS[(added * 5) % AVATARS.length],
        joinedAt: new Date(Date.now() + added).toISOString(),
        isBot: true,
      });
      added++;
    }
    this.write(db);
  }

  async resetDemo() {
    try {
      localStorage.removeItem(DB_KEY);
    } catch {
      /* ignore */
    }
    this.bc?.postMessage('change');
    this.emit();
  }
}

export function createDemoBackend(): Backend {
  return new DemoBackend();
}
