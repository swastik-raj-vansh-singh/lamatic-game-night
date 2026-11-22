'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBackend } from './backend';
import { isValidEmail } from './config';
import { isEmptyState, nextCandidate, normalizeState, startNextAttempt } from './game';
import type { AuthUser, Buzz, GameState, Player, WheelSpin } from './types';

/**
 * Live updates come over Supabase Realtime. As a backup, every hook also
 * re-reads on a timer and whenever the page comes back (phone unlocked, tab
 * re-opened, Wi-Fi back), so nobody gets stuck on an old screen.
 */
function useResync(load: () => void, everyMs: number) {
  const ref = useRef(load);
  ref.current = load;
  useEffect(() => {
    const run = () => ref.current();
    const iv = setInterval(run, everyMs);
    const onVisible = () => document.visibilityState === 'visible' && run();
    window.addEventListener('focus', run);
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(iv);
      window.removeEventListener('focus', run);
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [everyMs]);
}

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
  const load = useCallback(() => {
    void getBackend()
      .fetchPlayers()
      .then(players => setState({ players, loaded: true }));
  }, []);
  useEffect(() => {
    load();
    return getBackend().subscribePlayers(load);
  }, [load]);
  useResync(load, 10000);
  return state;
}

export function useGameState() {
  const [state, setState] = useState<{ game: GameState | null; empty: boolean }>({ game: null, empty: false });
  const apply = useCallback((raw: unknown) => {
    const next = normalizeState(raw);
    setState(prev => {
      // Ignore out-of-order reads that are older than what we already show.
      if (prev.game && !isEmptyState(raw) && next.version < prev.game.version) return prev;
      return { game: next, empty: isEmptyState(raw) };
    });
  }, []);
  const load = useCallback(() => {
    void getBackend().fetchState().then(apply);
  }, [apply]);
  useEffect(() => {
    load();
    return getBackend().subscribeState(apply);
  }, [load, apply]);
  useResync(load, 4000);
  return state;
}

export function useBuzzes(roundKey: string | null | undefined) {
  const [buzzes, setBuzzes] = useState<Buzz[]>([]);
  const keyRef = useRef(roundKey);
  keyRef.current = roundKey;
  const load = useCallback(() => {
    const key = keyRef.current;
    if (!key) return;
    void getBackend()
      .fetchBuzzes(key)
      .then(list => keyRef.current === key && setBuzzes(list));
  }, []);
  useEffect(() => {
    setBuzzes([]);
    if (!roundKey) return;
    load();
    return getBackend().subscribeBuzzes(roundKey, load);
  }, [roundKey, load]);
  useResync(load, 2500);
  return buzzes;
}

/** `fresh` is true only when the spin happened while this page was open, so it animates. */
export function useWheel() {
  const [state, setState] = useState<{ spin: WheelSpin; fresh: boolean; loaded: boolean }>({ spin: null, fresh: false, loaded: false });
  const first = useRef(true);
  const load = useCallback(() => {
    void getBackend()
      .fetchWheel()
      .then(spin => {
        const wasFirst = first.current;
        first.current = false;
        setState(prev => {
          if (!spin) return { spin: null, fresh: false, loaded: true };
          if (prev.spin && prev.spin.spunAt === spin.spunAt) return prev;
          return { spin, fresh: !wasFirst && !prev.spin, loaded: true };
        });
      });
  }, []);
  useEffect(() => {
    load();
    return getBackend().subscribeWheel(load);
  }, [load]);
  useResync(load, 4000);
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
    if (opts.needPlayer && loaded && !me && host === false) router.replace('/join');
  }, [loading, user, host, loaded, me, opts.needHost, opts.needPlayer, router]);

  const ready =
    !loading && !!user && isValidEmail(user.email) && loaded && host !== null && (!opts.needHost || host) && (!opts.needPlayer || !!me || host);

  return { user, me, players, host: !!host, ready };
}

/**
 * Host-side writer. Builds on the latest saved state; if another host screen
 * saved first, it reloads and re-applies the action instead of overwriting.
 */
export function useHostActions(game: GameState | null) {
  const latest = useRef<GameState | null>(game);
  if (game && (!latest.current || game.version >= latest.current.version)) latest.current = game;
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(async (fn: (s: GameState) => GameState | null) => {
    const b = getBackend();
    for (let attempt = 0; attempt < 4; attempt++) {
      const cur = latest.current;
      if (!cur) return;
      const next = fn(cur);
      if (!next || next === cur) return;
      const stamped = { ...next, version: cur.version + 1 };
      const res = await b.writeState(stamped, cur.version);
      if (!res.conflict) {
        if (!res.error) latest.current = stamped;
        setError(res.error ?? null);
        return;
      }
      latest.current = normalizeState(await b.fetchState());
    }
    setError('Another host screen keeps changing the game. Try again.');
  }, []);

  return { apply, error, latest };
}

/**
 * Buzzer engine: gives the turn to the fastest buzz (by server time). A short
 * pause lets near-simultaneous buzzes land before picking. Safe to run on more
 * than one host screen at once.
 */
export function useBuzzEngine(game: GameState | null, buzzes: Buzz[], apply: ReturnType<typeof useHostActions>['apply']) {
  useEffect(() => {
    if (!game || game.phase !== 'round' || game.round.status !== 'open') return;
    if (!nextCandidate(game, buzzes)) return;
    const key = game.round.key;
    const t = setTimeout(async () => {
      const latest = await getBackend().fetchBuzzes(key);
      await apply(s => (s.round.key === key ? startNextAttempt(s, latest) : null));
    }, 350);
    return () => clearTimeout(t);
  }, [game, buzzes, apply]);
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
