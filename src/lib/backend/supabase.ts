'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isValidEmail } from '../config';
import { randomId } from '../game';
import type { AuthUser, Buzz, GameState, Player, Song, WheelSpin } from '../types';
import type { Backend, Result, RoundLog, Unsubscribe } from './types';

type PlayerRow = { id: string; email: string; display_name: string; avatar: string; joined_at: string };
type BuzzRow = { id: number; round_key: string; player_id: string; reaction_ms: number | null; created_at: string };
type SongRow = { round: number; title: string; artist: string; source: string; start_sec: number; stop_sec: number; answer_line: string };
type WheelRow = { segment: number; spun_by: string; spun_at: string };

const toPlayer = (r: PlayerRow): Player => ({
  id: r.id,
  email: r.email,
  displayName: r.display_name,
  avatar: r.avatar,
  joinedAt: r.joined_at,
});

const toBuzz = (r: BuzzRow): Buzz => ({
  id: String(r.id),
  roundKey: r.round_key,
  playerId: r.player_id,
  reactionMs: r.reaction_ms,
  createdAt: r.created_at,
});

const toSong = (r: SongRow): Song => ({
  round: r.round,
  title: r.title,
  artist: r.artist,
  source: r.source,
  start: Number(r.start_sec),
  stop: Number(r.stop_sec),
  line: r.answer_line,
});

function friendly(message: string | undefined): string {
  if (!message) return 'Something went wrong. Try again.';
  if (/row-level security|violates row-level/i.test(message)) return 'You are not allowed to do that right now.';
  return message;
}

class SupabaseBackend implements Backend {
  mode = 'supabase' as const;
  private sb: SupabaseClient;

  constructor() {
    this.sb = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  private channel(name: string) {
    return this.sb.channel(`${name}-${randomId(8)}`);
  }

  async getUser(): Promise<AuthUser | null> {
    const { data } = await this.sb.auth.getUser();
    const u = data.user;
    return u && u.email ? { id: u.id, email: u.email } : null;
  }

  onAuthChange(cb: (u: AuthUser | null) => void): Unsubscribe {
    const { data } = this.sb.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      cb(u && u.email ? { id: u.id, email: u.email } : null);
    });
    return () => data.subscription.unsubscribe();
  }

  private callbackUrl(next: string) {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  }

  async signInWithGoogle(next: string): Promise<Result> {
    const { error } = await this.sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: this.callbackUrl(next),
        queryParams: { prompt: 'select_account' },
      },
    });
    return { error: error?.message };
  }

  async signInWithEmail(email: string, next: string): Promise<Result> {
    if (!isValidEmail(email)) return { error: 'Enter a valid email address.' };
    const { error } = await this.sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: this.callbackUrl(next), shouldCreateUser: true },
    });
    return { error: error?.message };
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async isHost() {
    const { data, error } = await this.sb.rpc('is_host');
    return !error && data === true;
  }

  async playerCount() {
    const { data, error } = await this.sb.rpc('player_count');
    return error ? null : (data as number);
  }

  async fetchPlayers() {
    const { data } = await this.sb.from('players').select('*').order('joined_at', { ascending: true });
    return ((data as PlayerRow[] | null) ?? []).map(toPlayer);
  }

  async upsertMe(name: string, avatar: string): Promise<Result> {
    const u = await this.getUser();
    if (!u) return { error: 'Sign in first.' };
    const { error } = await this.sb
      .from('players')
      .upsert({ id: u.id, email: u.email.toLowerCase(), display_name: name.trim().slice(0, 24), avatar }, { onConflict: 'id' });
    return { error: error ? friendly(error.message) : undefined };
  }

  async removePlayer(id: string): Promise<Result> {
    const { error } = await this.sb.from('players').delete().eq('id', id);
    return { error: error ? friendly(error.message) : undefined };
  }

  subscribePlayers(cb: () => void): Unsubscribe {
    const ch = this.channel('players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => cb())
      .subscribe();
    return () => void this.sb.removeChannel(ch);
  }

  async fetchState() {
    const { data } = await this.sb.from('game_state').select('state').eq('id', 1).maybeSingle();
    return (data as { state: unknown } | null)?.state ?? {};
  }

  async writeState(s: GameState, expectedVersion: number | null) {
    let q = this.sb.from('game_state').update({ state: s, updated_at: new Date().toISOString() }).eq('id', 1);
    if (expectedVersion !== null) q = q.eq('state->>version', String(expectedVersion));
    const { data, error } = await q.select('id');
    if (error) return { error: friendly(error.message) };
    if (!data || data.length === 0) return { conflict: true };
    return {};
  }

  subscribeState(cb: (raw: unknown) => void): Unsubscribe {
    const ch = this.channel('state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, payload => {
        const row = payload.new as { state?: unknown } | undefined;
        if (row && 'state' in row) cb(row.state);
        else void this.fetchState().then(cb);
      })
      .subscribe();
    return () => void this.sb.removeChannel(ch);
  }

  async fetchBuzzes(roundKey: string) {
    const { data } = await this.sb
      .from('buzzes')
      .select('*')
      .eq('round_key', roundKey)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    return ((data as BuzzRow[] | null) ?? []).map(toBuzz);
  }

  subscribeBuzzes(roundKey: string, cb: () => void): Unsubscribe {
    const ch = this.channel('buzzes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'buzzes', filter: `round_key=eq.${roundKey}` }, () => cb())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'buzzes' }, () => cb())
      .subscribe();
    return () => void this.sb.removeChannel(ch);
  }

  async buzz(roundKey: string, reactionMs: number) {
    const { error } = await this.sb.from('buzzes').insert({ round_key: roundKey, reaction_ms: Math.round(reactionMs) });
    if (!error) return {};
    if (error.code === '23505') return { already: true };
    if (/row-level security/i.test(error.message)) return { error: 'Buzzers are closed.' };
    return { error: friendly(error.message) };
  }

  async clearBuzzes(): Promise<Result> {
    const { error } = await this.sb.from('buzzes').delete().gt('id', 0);
    return { error: error ? friendly(error.message) : undefined };
  }

  async fetchSongs() {
    const { data } = await this.sb.from('songs').select('*').order('round', { ascending: true });
    return ((data as SongRow[] | null) ?? []).map(toSong);
  }

  async saveSongs(songs: Song[]): Promise<Result> {
    const rows = songs.map(s => ({
      round: s.round,
      title: s.title,
      artist: s.artist,
      source: s.source,
      start_sec: s.start,
      stop_sec: s.stop,
      answer_line: s.line,
    }));
    const { error } = await this.sb.from('songs').upsert(rows, { onConflict: 'round' });
    return { error: error ? friendly(error.message) : undefined };
  }

  async fetchWheel(): Promise<WheelSpin> {
    const { data } = await this.sb.from('wheel_spins').select('*').eq('id', 1).maybeSingle();
    const r = data as WheelRow | null;
    return r ? { segment: r.segment, spunBy: r.spun_by, spunAt: r.spun_at } : null;
  }

  subscribeWheel(cb: () => void): Unsubscribe {
    const ch = this.channel('wheel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wheel_spins' }, () => cb())
      .subscribe();
    return () => void this.sb.removeChannel(ch);
  }

  async spin() {
    const { data, error } = await this.sb.rpc('spin_wheel');
    if (error) return { error: friendly(error.message) };
    return { segment: data as number };
  }

  async resetWheel(): Promise<Result> {
    const { error } = await this.sb.rpc('reset_wheel');
    return { error: error ? friendly(error.message) : undefined };
  }

  async logRound(r: RoundLog) {
    await this.sb.from('round_results').upsert(
      {
        round: r.round,
        round_key: r.roundKey,
        outcome: r.outcome,
        team: r.team,
        answered_by: r.answeredBy,
        points: r.points,
      },
      { onConflict: 'round_key' },
    );
  }
}

export function createSupabaseBackend(): Backend {
  return new SupabaseBackend();
}
