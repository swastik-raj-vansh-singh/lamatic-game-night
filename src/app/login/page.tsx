'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Bulbs, DemoBanner } from '@/components/ui';
import { getBackend } from '@/lib/backend';
import { DEMO, EMAIL_DOMAIN, isAllowedEmail } from '@/lib/config';
import { useAuth } from '@/lib/hooks';

function errorText(code: string | null): string | null {
  if (!code) return null;
  if (code === 'domain' || /database error|saving new user|email addresses can join/i.test(code)) {
    return `Only @${EMAIL_DOMAIN} accounts can join game night. Sign in with your work email.`;
  }
  return code;
}

function LoginInner() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [asHost, setAsHost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setError(errorText(params.get('error')));
  }, []);

  useEffect(() => {
    if (!loading && user && isAllowedEmail(user.email)) router.replace('/join');
  }, [loading, user, router]);

  const b = getBackend();

  async function google() {
    setBusy(true);
    setError(null);
    const { error } = await b.signInWithGoogle('/join');
    if (error) {
      setError(error);
      setBusy(false);
    }
  }

  async function emailLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isAllowedEmail(email)) {
      setError(`Use your @${EMAIL_DOMAIN} email address.`);
      return;
    }
    setBusy(true);
    if (DEMO && b.signInDemo) {
      const { error } = await b.signInDemo(email, asHost);
      setBusy(false);
      if (error) setError(error);
      else router.replace('/join');
      return;
    }
    const { error } = await b.signInWithEmail(email, '/join');
    setBusy(false);
    if (error) setError(error);
    else setSent(true);
  }

  return (
    <>
      <DemoBanner />
      <main className="shell narrow" style={{ minHeight: '100vh', alignContent: 'center' }}>
        <div className="card auth-card" style={{ gap: 18 }}>
          <Bulbs count={14} />
          <div style={{ display: 'grid', gap: 6, textAlign: 'center' }}>
            <p className="eyebrow">Lamatic Game Night</p>
            <h2>Sign in to play</h2>
            <p className="muted">Only @{EMAIL_DOMAIN} emails can get in.</p>
          </div>

          {sent ? (
            <div className="card" style={{ background: 'var(--stage)', textAlign: 'center' }}>
              <h3>Check your inbox</h3>
              <p>
                We sent a sign-in link to <b>{email}</b>. Open it in this same browser.
              </p>
              <button type="button" className="ghost small" onClick={() => setSent(false)}>
                Use a different email
              </button>
            </div>
          ) : (
            <>
              {!DEMO && (
                <>
                  <button type="button" className="big" onClick={google} disabled={busy}>
                    Continue with Google
                  </button>
                  <p className="divider">or get an email link</p>
                </>
              )}
              <form onSubmit={emailLink} style={{ display: 'grid', gap: 12 }} noValidate>
                <div className="field">
                  <label htmlFor="email">Work email</label>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={`you@${EMAIL_DOMAIN}`}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                {DEMO && (
                  <label className="row" style={{ gap: 8, fontWeight: 600 }}>
                    <input id="as-host" type="checkbox" checked={asHost} onChange={e => setAsHost(e.target.checked)} style={{ width: 'auto' }} />
                    Sign in as the host (demo only)
                  </label>
                )}
                <button type="submit" className={DEMO ? 'big' : 'teal'} disabled={busy}>
                  {DEMO ? 'Enter demo' : busy ? 'Sending…' : 'Email me a sign-in link'}
                </button>
              </form>
            </>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Link href="/" className="muted" style={{ textAlign: 'center', fontSize: '0.9rem' }}>
            Back to the start
          </Link>
        </div>
      </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
