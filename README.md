# Lamatic Game Night

A live game-night site for a remote team on Google Meet:

1. **Sign in** with any email or Google account, pick a name and an avatar. Names appear live in the lobby.
2. **Game 1: drawing game.** The host pastes an invite link (skribbl.io, Gartic Phone…) and everyone gets a Join button. The host adds +3/+2/+1 for the top three.
3. **Game 2: Guess the next line.** Random, balanced teams (15 players → 3 teams of 5). The host plays a clip that stops right before a line. Everyone has a buzzer on their own device. The fastest buzz (server-timed) gets **5 seconds** to sing the next line. Wrong? The turn passes to the next fastest team. Correct: the singer gets **+2**, every teammate **+1**, and the team **+100**. The last round is worth **double**.
4. **Live leaderboard** after every round, Menti-style: rows slide into their new places and scores count up.
5. **Finale:** the top scorer spins the prize wheel (3 mystery gifts, 2 "better luck next time"). The server picks the slice and allows one spin, and everyone watches it spin on their own screen.

## The three screens

| Page | Who | What it's for |
|---|---|---|
| `/play` | Everyone | Lobby, teams, the buzzer, leaderboard, wheel |
| `/stage` | Host | **Share this tab on Meet** with "Also share tab audio". Plays the song clips, runs the buzzers, shows the big screen and your controls. |
| `/host` | Host | Private console: the **correct line** for each round, judging, teams, points, song editor, settings. Keep it on your phone or a second window. |

## Try it right now (demo mode)

No backend needed. Without Supabase keys the app runs entirely in your browser.

```bash
npm install
npm run dev
```

Open http://localhost:3000, sign in with any email address and tick **Sign in as the host**. In the host console → Players, click **Add 14 test players**. Then open the Stage and run a round. Test players buzz on their own. Each extra browser tab you sign into is another player.

## Go live with Supabase

1. **Create a Supabase project** (a new one, just for game night).
2. **Database:** Supabase → SQL Editor → paste all of [`supabase/schema.sql`](supabase/schema.sql) → Run. Then make yourself the host:
   ```sql
   insert into public.hosts (email) values ('you@example.com');
   ```
3. **Sign-in methods** (Supabase → Authentication → Sign In / Providers):
   - **Google (recommended).** Lamatic uses Google Workspace, so this is one click for everyone. Create an OAuth client in Google Cloud Console (type "Web application"), add `https://<your-project>.supabase.co/auth/v1/callback` as an authorized redirect URI, then paste the client ID and secret into Supabase's Google provider.
   - **Email link.** Already on by default. Supabase's built-in email sender only allows a few emails per hour, so for 15 people either use Google or add your own SMTP (Authentication → Emails → SMTP settings, for example with Resend).
4. **Redirect URLs** (Authentication → URL Configuration): set the Site URL to your Vercel URL and add both
   `http://localhost:3000/auth/callback` and `https://<your-vercel-domain>/auth/callback`.
5. **Environment variables:** copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API; the anon or publishable key, **never** the service-role key).

### What the database enforces

- Anyone with the link can sign in. Only signed-in people can see names, buzzes and scores, and the host can remove anyone from Host → Players.
- Only hosts can change the game, read the songs table (it holds the correct lines) or reset the wheel.
- Buzz times come from the database clock (`clock_timestamp()`), and players can only send which round they buzzed. They can't fake an earlier buzz. Each player can buzz once per round, and only while buzzers are open.
- Only the crowned winner can spin, only once, and the slice is picked by the database.
- Every finished round is logged in `round_results`.

## Songs

Host console → **Songs**: for each of the 10 rounds set the title, artist, an audio source, the second the clip starts, the second it stops (right before the line), and the correct next line. The 10 rounds ship as placeholders that play a generated demo tune.

Audio sources:
- **Audio files (best):** put `round1.mp3` etc. in `public/songs/` and use `/songs/round1.mp3`. Nothing about the song shows on screen.
- **YouTube links** also work. The small player is visible on the Stage, so pick a version that doesn't show lyrics.

After a round, **▶ Play the real line** plays the next 8 seconds so everyone hears the answer.

## Deploy on Vercel

1. Push this folder to GitHub (it can be its own repo or a folder in a bigger one).
2. Vercel → Add New → Project → import the repo. If the app lives in a subfolder, set **Root Directory** to `game-night`.
3. Add the two environment variables from `.env.example` under Settings → Environment Variables.
4. Deploy, then add the Vercel URL to Supabase's redirect URLs (step 4 above).

## Running game night

1. Before the call: add songs, set the Game 1 link (Settings), open `/stage` and `/host`.
2. On Meet: share the Stage tab with tab audio. Ask everyone to open the site, sign in and pick a name.
3. Stage → **Start Game 1** → after the drawing game, add the top-3 points in Host → Players.
4. Stage → **Shuffle teams** (shuffle again if you like) → **Start Round 1**.
5. Each round: **▶ Play clip** → someone buzzes and the music stops → listen → **✓ Correct** or **✗ Wrong** → **Reveal the line** → **Leaderboard** → next round.
6. After round 10: **Crown the winner** → they press **Spin the wheel** on their own screen → send their voucher code privately.

Points, teams and rounds can be fixed at any time from the host console. **Restart this round** takes back the points the round gave.

## Tech

Next.js 15 (App Router) · React 19 · Supabase (Auth, Postgres, Realtime) · plain CSS. The game rules are pure functions in `src/lib/game.ts`. The host's browser applies them and writes one `game_state` row, and every screen follows that row live.
