'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBackend } from './backend';
import { isValidEmail } from './config';
import { isEmptyState, normalizeState } from './game';
import type { AuthUser, Buzz, GameState, Player, WheelSpin } from './types';

export function useAuth() {
  const [state, setState] = useState<{ user: AuthUser | null; loading: boolean }>({ user: null, loading: true });
  useEffect(() => {
    const b = getBackend();
    let alive = true;
    b.getUser().then(u => alive && setState({ user: u, loading: false }));
    const off = b.onAuthChange(u => alive && setState({ user: u, loading: false }));
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}

export function usePlayers() {
  const [state, setState] = useState<{ players: Player[]; loaded: boolean }>({ players: [], loaded: false });
  useEffect(() => {
    const b = getBackend();
    let alive = true;
    const load = () => b.fetchPlayers().then(players => alive && setState({ players, loaded: true }));
    void load();
    const off = b.subscribePlayers(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}

export function useGameState() {
  const [state, setState] = useState<{ game: GameState | null; empty: boolean }>({ game: null, empty: false });
  useEffect(() => {
    const b = getBackend();
    let alive = true;
    const apply = (raw: unknown) => alive && setState({ game: normalizeState(raw), empty: isEmptyState(raw) });
    b.fetchState().then(apply);
    const off = b.subscribeState(apply);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}

export function useBuzzes(roundKey: string | null | undefined) {
  const [buzzes, setBuzzes] = useState<Buzz[]>([]);
  useEffect(() => {
    if (!roundKey) {
      setBuzzes([]);
      return;
    }
    const b = getBackend();
    let alive = true;
    const load = () => b.fetchBuzzes(roundKey).then(list => alive && setBuzzes(list));
    setBuzzes([]);
    void load();
    const off = b.subscribeBuzzes(roundKey, () => void load());
    return () => {
      alive = false;
      off();
    };
  }, [roundKey]);
  return buzzes;
}

/** `fresh` is true only when the spin happened while this page was open, so it animates. */
export function useWheel() {
  const [state, setState] = useState<{ spin: WheelSpin; fresh: boolean; loaded: boolean }>({ spin: null, fresh: false, loaded: false });
  useEffect(() => {
    const b = getBackend();
    let alive = true;
    let first = true;
    const load = () =>
      b.fetchWheel().then(spin => {
        if (!alive) return;
        setState(prev => ({ spin, fresh: !first && !!spin && !prev.spin, loaded: true }));
        first = false;
      });
    void load();
    const off = b.subscribeWheel(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}

export function useIsHost(user: AuthUser | null) {
  const [host, setHost] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) {
      setHost(null);
      return;
    }
    let alive = true;
    getBackend()
      .isHost()
      .then(h => alive && setHost(h));
    return () => {
      alive = false;
    };
  }, [user]);
  return host;
}

/**
 * Page gate: sends signed-out people to /login, people without a name to /join,
 * and non-hosts away from host pages.
 */
export function useGate(opts: { needPlayer?: boolean; needHost?: boolean } = {}) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { players, loaded } = usePlayers();
  const host = useIsHost(user);
  const me = useMemo(() => (user ? players.find(p => p.id === user.id) ?? null : null), [players, user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (opts.needHost && host === false) {
      router.replace('/play');
      return;
    }
    if (opts.needPlayer && loaded && !me && host !== null && !(opts.needHost && host)) {
      router.replace('/join');
    }
  }, [loading, user, host, loaded, me, opts.needHost, opts.needPlayer, router]);

  const ready =
    !loading &&
    !!user &&
    isValidEmail(user.email) &&
    loaded &&
    host !== null &&
    (!opts.needHost || host) &&
    (!opts.needPlayer || !!me || (opts.needHost && host));

  return { user, me, players, host: !!host, ready };
}

/** Host-side writer that always builds on the latest state it has seen. */
export function useHostActions(game: GameState | null) {
  const latest = useRef<GameState | null>(game);
  latest.current = game;
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(async (fn: (s: GameState) => GameState | null) => {
    const cur = latest.current;
    if (!cur) return;
    const next = fn(cur);
    if (!next || next === cur) return;
    latest.current = next;
    const { error } = await getBackend().writeState(next);
    setError(error ?? null);
  }, []);

  return { apply, error, latest };
}

/** Milliseconds left on a local countdown that restarts whenever `runKey` changes. */
export function useCountdown(runKey: string | null, ms: number, onEnd?: () => void) {
  const [left, setLeft] = useState(ms);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    if (!runKey) {
      setLeft(ms);
      return;
    }
    const start = performance.now();
    let raf = 0;
    let done = false;
    const loop = (now: number) => {
      const l = Math.max(0, ms - (now - start));
      setLeft(l);
      if (l > 0) raf = requestAnimationFrame(loop);
      else if (!done) {
        done = true;
        endRef.current?.();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [runKey, ms]);
  return left;
}
