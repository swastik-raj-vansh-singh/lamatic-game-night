'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { getBackend } from '@/lib/backend';
import { DEMO } from '@/lib/config';
import { isMuted, setMuted, sfx } from '@/lib/sfx';
import type { Player, TeamId } from '@/lib/types';

export function Bulbs({ count = 18 }: { count?: number }) {
  return (
    <div className="bulb-row" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}

export function DemoBanner() {
  if (!DEMO) return null;
  return (
    <div className="demo-banner" role="note">
      Demo mode: no backend yet, data stays in this browser. Add your Supabase keys to go live.
    </div>
  );
}

export const teamStyle = (team: TeamId | undefined | null): CSSProperties =>
  ({ ['--team' as string]: team ? `var(--team-${team})` : 'var(--line)' }) as CSSProperties;

export function TeamChip({ team }: { team: TeamId | undefined | null }) {
  if (!team) return null;
  return (
    <span className="chip team-chip" data-team={team} style={teamStyle(team)}>
      Team {team}
    </span>
  );
}

export function SoundToggle() {
  const [muted, setM] = useState(false);
  useEffect(() => setM(isMuted()), []);
  return (
    <button
      type="button"
      className="ghost small"
      aria-pressed={!muted}
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setM(next);
        if (!next) sfx.ding();
      }}
    >
      {muted ? 'Sound off' : 'Sound on'}
    </button>
  );
}

export function TopBar({ me, team, points, host }: { me?: Player | null; team?: TeamId | null; points?: number; host?: boolean }) {
  const router = useRouter();
  return (
    <>
      <DemoBanner />
      <header className="topbar">
        <div className="topbar-in">
          <Link className="brand" href="/">
            Lamatic <span>Game Night</span>
          </Link>
          <div className="row">
            {me && (
              <span className="me-pill">
                <span className="avatar" aria-hidden="true">
                  {me.avatar}
                </span>
                <span>{me.displayName}</span>
                <TeamChip team={team} />
                {typeof points === 'number' && <span className="chip num">{points} pts</span>}
              </span>
            )}
            {host && (
              <>
                <Link className="btn ghost small" href="/stage">
                  Stage
                </Link>
                <Link className="btn ghost small" href="/host">
                  Host console
                </Link>
              </>
            )}
            <SoundToggle />
            <button
              type="button"
              className="ghost small"
              onClick={async () => {
                await getBackend().signOut();
                router.replace('/');
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

export function Loading({ label = 'Loading game night…' }: { label?: string }) {
  return (
    <div className="center">
      <div className="row" style={{ justifyContent: 'center' }}>
        <span className="display" style={{ color: 'var(--bulb)' }}>
          {label}
        </span>
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (m: string) => {
    setMsg(m);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(null), 2600);
  };
  const node = msg ? (
    <p className="toast" role="status">
      {msg}
    </p>
  ) : null;
  return { show, node };
}

/** Number that counts up/down to its new value. */
export function CountUp({ value, ms = 900 }: { value: number; ms?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return;
    let raf = 0;
    const loop = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      const v = Math.round(a + (b - a) * e);
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(loop);
      else from.current = b;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      from.current = b;
    };
  }, [value, ms]);
  return <>{shown}</>;
}

/** Two clicks to confirm a destructive action. */
export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'ghost small' }: { label: string; confirmLabel: string; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={armed ? 'coral small' : className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
