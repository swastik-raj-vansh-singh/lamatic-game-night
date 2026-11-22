'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bulbs, DemoBanner } from '@/components/ui';
import { getBackend } from '@/lib/backend';
import { EMAIL_DOMAIN, EVENT_DATE_LABEL } from '@/lib/config';
import { useAuth } from '@/lib/hooks';

const NOTES = ['♪', '♫', '♬', '♩', '♪', '♫', '♬', '♪'];

export default function Landing() {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => getBackend().playerCount().then(n => alive && setCount(n));
    void load();
    const iv = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <>
      <DemoBanner />
      <main className="landing">
        <div className="landing-sweep" aria-hidden="true" />
        <div className="notes" aria-hidden="true">
          {NOTES.map((n, i) => (
            <span key={i} style={{ left: `${8 + i * 12}%`, animationDelay: `${i * 1.1}s`, fontSize: `${1.2 + (i % 3) * 0.5}rem` }}>
              {n}
            </span>
          ))}
        </div>

        <div className="marquee">
          <Bulbs />
          <p className="eyebrow">Lamatic presents · {EVENT_DATE_LABEL}</p>
          <h1>Game Night</h1>
          <p className="lede">Draw badly. Sing loudly. Buzz first. One champion spins for a mystery gift.</p>

          <div className="acts">
            <div className="act">
              <span>Game 1</span>
              <b>Draw it</b>
            </div>
            <div className="act">
              <span>Game 2</span>
              <b>Finish the line</b>
            </div>
            <div className="act finale">
              <span>Finale</span>
              <b>Spin to win</b>
            </div>
          </div>

          <Link className="btn big" href={user ? '/play' : '/login'}>
            {user ? 'Enter game night' : "I'm in"}
          </Link>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Sign in with your @{EMAIL_DOMAIN} email
          </p>
          {count !== null && (
            <p className="live-pill" aria-live="polite">
              <i aria-hidden="true" />
              {count === 0 ? 'Be the first one in' : `${count} ${count === 1 ? 'player is' : 'players are'} in the lobby`}
            </p>
          )}
          <Bulbs />
        </div>
      </main>
    </>
  );
}
