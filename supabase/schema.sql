-- =====================================================================
-- Lamatic Game Night: database setup
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- It is safe to run again: every statement is idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Who may join, and who is the host
-- ---------------------------------------------------------------------

-- Anyone who signs in (any email or Google account) can play.
-- These lines also remove the old "@lamatic.ai only" lock if an earlier
-- version of this file was run.
drop trigger if exists enforce_email_domain on auth.users;
drop function if exists public.enforce_email_domain();

create or replace function public.is_member()
returns boolean language sql stable as $$
  select auth.uid() is not null;
$$;

drop function if exists public.email_is_allowed(text);
drop function if exists public.allowed_email_domain();

-- Hosts can run the game (stage + host console). Add your email at the bottom of this file.
create table if not exists public.hosts (
  email text primary key
);
alter table public.hosts enable row level security;
-- No policies: nobody can read or change this table from the app.

create or replace function public.is_host()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hosts h
    where lower(h.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Players: one row per signed-in person, with the name they picked
-- ---------------------------------------------------------------------
create table if not exists public.players (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 24),
  avatar       text not null default '🎤' check (char_length(avatar) <= 16),
  joined_at    timestamptz not null default now()
);
alter table public.players enable row level security;
grant select, insert, update, delete on public.players to authenticated;

drop policy if exists "members read players" on public.players;
create policy "members read players" on public.players
  for select to authenticated using (public.is_member() or public.is_host());

drop policy if exists "players add themselves" on public.players;
create policy "players add themselves" on public.players
  for insert to authenticated
  with check (id = auth.uid() and public.is_member() and lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "players edit themselves" on public.players;
create policy "players edit themselves" on public.players
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "host removes players" on public.players;
create policy "host removes players" on public.players
  for delete to authenticated using (public.is_host());

-- Public count for the landing page (no names, just a number).
create or replace function public.player_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.players;
$$;
grant execute on function public.player_count() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Game state: one row the host writes, everyone reads live
-- ---------------------------------------------------------------------
create table if not exists public.game_state (
  id         int primary key default 1 check (id = 1),
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.game_state enable row level security;
grant select, insert, update on public.game_state to authenticated;
insert into public.game_state (id, state) values (1, '{}'::jsonb) on conflict (id) do nothing;

drop policy if exists "members read state" on public.game_state;
create policy "members read state" on public.game_state
  for select to authenticated using (public.is_member() or public.is_host());

drop policy if exists "host updates state" on public.game_state;
create policy "host updates state" on public.game_state
  for update to authenticated using (public.is_host()) with check (public.is_host());

drop policy if exists "host inserts state" on public.game_state;
create policy "host inserts state" on public.game_state
  for insert to authenticated with check (public.is_host());

-- ---------------------------------------------------------------------
-- 4. Buzzes: the server stamps the time, so the order is fair
-- ---------------------------------------------------------------------
create table if not exists public.buzzes (
  id          bigint generated always as identity primary key,
  round_key   text not null,
  player_id   uuid not null default auth.uid() references public.players (id) on delete cascade,
  reaction_ms int check (reaction_ms between 0 and 600000),
  created_at  timestamptz not null default clock_timestamp(),
  unique (round_key, player_id)
);
create index if not exists buzzes_round_key_idx on public.buzzes (round_key, created_at);
alter table public.buzzes enable row level security;

-- Players may only send round_key and reaction_ms. player_id and created_at
-- always come from the server, so nobody can fake an earlier buzz.
revoke insert, update on public.buzzes from anon, authenticated;
grant insert (round_key, reaction_ms) on public.buzzes to authenticated;
grant select, delete on public.buzzes to authenticated;

drop policy if exists "members read buzzes" on public.buzzes;
create policy "members read buzzes" on public.buzzes
  for select to authenticated using (public.is_member() or public.is_host());

drop policy if exists "players buzz while open" on public.buzzes;
create policy "players buzz while open" on public.buzzes
  for insert to authenticated
  with check (
    player_id = auth.uid()
    and exists (
      select 1 from public.game_state g
      where g.id = 1
        and g.state ->> 'phase' = 'round'
        and g.state #>> '{round,key}' = round_key
        and g.state #>> '{round,status}' in ('open', 'answering')
    )
  );

drop policy if exists "host clears buzzes" on public.buzzes;
create policy "host clears buzzes" on public.buzzes
  for delete to authenticated using (public.is_host());

-- ---------------------------------------------------------------------
-- 5. Songs: only the host can see them (they hold the correct lines)
-- ---------------------------------------------------------------------
create table if not exists public.songs (
  round       int primary key check (round between 1 and 50),
  title       text not null default '',
  artist      text not null default '',
  source      text not null default '',   -- audio file URL or YouTube link
  start_sec   numeric not null default 0,  -- clip starts here
  stop_sec    numeric not null default 10, -- clip stops here, right before the line
  answer_line text not null default ''     -- the correct next line (host only)
);
alter table public.songs enable row level security;
grant select, insert, update, delete on public.songs to authenticated;

drop policy if exists "host manages songs" on public.songs;
create policy "host manages songs" on public.songs
  for all to authenticated using (public.is_host()) with check (public.is_host());

-- Ten practice rounds: traditional songs with clips in public/songs/trial-*.mp3.
-- Replace them with your real songs in the host console (Songs tab).
insert into public.songs (round, title, artist, source, start_sec, stop_sec, answer_line) values
  (1, 'Twinkle, Twinkle, Little Star', 'Traditional', '/songs/trial-01.mp3', 0, 5.27, 'How I wonder what you are'),
  (2, 'Jingle Bells', 'Traditional', '/songs/trial-02.mp3', 0, 3.9, 'Jingle all the way'),
  (3, 'Mary Had a Little Lamb', 'Traditional', '/songs/trial-03.mp3', 0, 4.83, 'Little lamb, little lamb'),
  (4, 'Old MacDonald Had a Farm', 'Traditional', '/songs/trial-04.mp3', 0, 4.47, 'E-I-E-I-O'),
  (5, 'Row, Row, Row Your Boat', 'Traditional', '/songs/trial-05.mp3', 0, 2.65, 'Gently down the stream'),
  (6, 'London Bridge Is Falling Down', 'Traditional', '/songs/trial-06.mp3', 0, 4.83, 'Falling down, falling down'),
  (7, 'Are You Sleeping (Frère Jacques)', 'Traditional', '/songs/trial-07.mp3', 0, 4.83, 'Brother John, Brother John'),
  (8, 'Yankee Doodle', 'Traditional', '/songs/trial-08.mp3', 0, 2.22, 'A-riding on a pony'),
  (9, 'Hot Cross Buns', 'Traditional', '/songs/trial-09.mp3', 0, 4.83, 'One a penny, two a penny'),
  (10, 'Auld Lang Syne', 'Traditional', '/songs/trial-10.mp3', 0, 5.8, 'And never brought to mind')
on conflict (round) do nothing;

-- ---------------------------------------------------------------------
-- 6. Prize wheel: the server picks the slice, and only the winner can spin
-- ---------------------------------------------------------------------
create table if not exists public.wheel_spins (
  id       int primary key default 1 check (id = 1),
  segment  int not null check (segment between 0 and 4),
  spun_by  uuid not null,
  spun_at  timestamptz not null default now()
);
alter table public.wheel_spins enable row level security;
revoke insert, update, delete on public.wheel_spins from anon, authenticated;
grant select on public.wheel_spins to authenticated;

drop policy if exists "members read wheel" on public.wheel_spins;
create policy "members read wheel" on public.wheel_spins
  for select to authenticated using (public.is_member() or public.is_host());
-- No write policies: only the two functions below can change it.

create or replace function public.spin_wheel()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_state jsonb;
  v_segment int;
begin
  select state into v_state from public.game_state where id = 1;
  if v_state ->> 'phase' is distinct from 'wheel' then
    raise exception 'The wheel is not open yet';
  end if;
  if v_state ->> 'winnerId' is distinct from auth.uid()::text then
    raise exception 'Only the winner can spin the wheel';
  end if;
  v_segment := floor(random() * 5)::int;  -- 0 Gift 1, 1 miss, 2 Gift 2, 3 Gift 3, 4 miss
  insert into public.wheel_spins (id, segment, spun_by) values (1, v_segment, auth.uid())
  on conflict (id) do nothing;
  if not found then
    raise exception 'The wheel has already been spun';
  end if;
  return v_segment;
end $$;
revoke all on function public.spin_wheel() from public, anon;
grant execute on function public.spin_wheel() to authenticated;

create or replace function public.reset_wheel()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_host() then
    raise exception 'Only the host can reset the wheel';
  end if;
  delete from public.wheel_spins where id = 1;
end $$;
revoke all on function public.reset_wheel() from public, anon;
grant execute on function public.reset_wheel() to authenticated;

grant execute on function public.is_host() to authenticated;

-- ---------------------------------------------------------------------
-- 7. Round history: one row per finished round, for the record
-- ---------------------------------------------------------------------
create table if not exists public.round_results (
  id          bigint generated always as identity primary key,
  round       int not null,
  round_key   text not null unique,
  outcome     text not null check (outcome in ('won', 'failed')),
  team        text,
  answered_by uuid,
  points      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
alter table public.round_results enable row level security;
grant select, insert, update on public.round_results to authenticated;

drop policy if exists "members read results" on public.round_results;
create policy "members read results" on public.round_results
  for select to authenticated using (public.is_member() or public.is_host());

drop policy if exists "host writes results" on public.round_results;
create policy "host writes results" on public.round_results
  for all to authenticated using (public.is_host()) with check (public.is_host());

-- ---------------------------------------------------------------------
-- 8. Live updates
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['game_state', 'players', 'buzzes', 'wheel_spins'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 9. Make yourself the host: put the email you sign in with here, then run.
-- ---------------------------------------------------------------------
-- insert into public.hosts (email) values ('you@example.com') on conflict do nothing;
