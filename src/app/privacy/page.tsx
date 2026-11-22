import Link from 'next/link';

export const metadata = {
  title: 'Privacy · Lamatic Game Night',
  description: 'What Lamatic Game Night stores about you and why.',
};

export default function PrivacyPage() {
  return (
    <main className="shell narrow">
      <article className="card" style={{ gap: 16 }}>
        <p className="eyebrow">Lamatic Game Night</p>
        <h2>Privacy policy</h2>
        <p className="muted">Last updated: 22 November 2026</p>

        <h3>What this site is</h3>
        <p>
          Lamatic Game Night is a small website for a team game night: players sign in, pick a display name, buzz in during a music round and see a live
          scoreboard.
        </p>

        <h3>What we store</h3>
        <ul>
          <li>Your email address, from Google sign-in or the email sign-in link, so the game knows who you are.</li>
          <li>The display name and avatar you choose.</li>
          <li>Your game activity: your team, your points and the time you pressed the buzzer.</li>
        </ul>
        <p>We do not read your contacts, files, calendar or anything else in your Google account. Google only shares your name, email address and profile picture with the app.</p>

        <h3>How it is used</h3>
        <p>
          Only to run the game night: showing your name in the lobby and on the scoreboard, deciding who buzzed first, and picking the winner. Other signed-in
          players can see your display name, avatar, team and points. The host can also see your email address.
        </p>

        <h3>Where it is kept</h3>
        <p>
          The data is stored in a Supabase database used only for this game. The site is hosted on Vercel. We do not sell or share your data with anyone
          else, and we do not use it for advertising.
        </p>

        <h3>Deleting your data</h3>
        <p>Ask the game night host and they will remove your player and account. Game data is not needed after the event and can be deleted at any time.</p>

        <Link className="btn ghost" href="/" style={{ justifySelf: 'start' }}>
          Back to game night
        </Link>
      </article>
    </main>
  );
}
