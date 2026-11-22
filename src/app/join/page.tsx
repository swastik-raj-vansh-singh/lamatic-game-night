'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loading, TopBar } from '@/components/ui';
import { getBackend } from '@/lib/backend';
import { AVATARS } from '@/lib/config';
import { useGate } from '@/lib/hooks';
import { sfx } from '@/lib/sfx';

export default function JoinPage() {
  const router = useRouter();
  const { user, me, host, ready } = useGate();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Hosts don't play: send them straight to the Stage.
  useEffect(() => {
    if (ready && host) router.replace('/stage');
  }, [ready, host, router]);

  useEffect(() => {
    if (touched) return;
    if (me) {
      setName(me.displayName);
      setAvatar(me.avatar);
    } else if (user) {
      const guess = user.email.split('@')[0].split(/[._-]/)[0];
      setName(guess ? guess[0].toUpperCase() + guess.slice(1) : '');
      setAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
    }
  }, [me, user, touched]);

  if (!ready || !user || host) return <Loading />;

  const trimmed = name.trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed) {
      setError('Pick a name so everyone knows who buzzed.');
      return;
    }
    setBusy(true);
    setError(null);
    sfx.unlock();
    const { error } = await getBackend().upsertMe(trimmed, avatar);
    setBusy(false);
    if (error) setError(error);
    else {
      sfx.pop();
      router.replace('/play');
    }
  }

  return (
    <>
      <TopBar me={me} host={host} />
      <main className="shell narrow">
        <form className="card" onSubmit={save} style={{ gap: 18 }} noValidate>
          <div style={{ display: 'grid', gap: 6 }}>
            <p className="eyebrow">Signed in as {user.email}</p>
            <h2>{me ? 'Change your name' : 'What should we call you?'}</h2>
            <p className="muted">This name shows up on the scoreboard, the buzzer list and everyone&apos;s screen.</p>
          </div>

          <div className="field">
            <label htmlFor="display-name">Your game name</label>
            <input
              id="display-name"
              maxLength={24}
              autoComplete="nickname"
              value={name}
              onChange={e => {
                setTouched(true);
                setName(e.target.value);
              }}
              placeholder="e.g. Riya the Rockstar"
              required
            />
            <span className="hint num">{24 - name.length} characters left</span>
          </div>

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            <legend style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8 }}>Pick an avatar</legend>
            <div className="avatar-grid">
              {AVATARS.map(a => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={a === avatar}
                  aria-label={`Avatar ${a}`}
                  onClick={() => {
                    setTouched(true);
                    setAvatar(a);
                    sfx.tick();
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="name-preview" aria-label="Preview">
            <span className="avatar" aria-hidden="true">
              {avatar}
            </span>
            <b>{trimmed || 'Your name'}</b>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="big" disabled={busy}>
            {busy ? 'Saving…' : me ? 'Save and go back' : "Let's go"}
          </button>
        </form>
      </main>
    </>
  );
}
