-- كورة سمارت — Supabase schema.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Players never read the bookings table directly: they go through the
-- functions below, which return only what a player may see. Admins are
-- signed-in users listed in public.admins (see README for adding yourself).

-- ---------------------------------------------------------------- tables

create table if not exists public.settings (
  id           int primary key default 1 check (id = 1),
  stc_number   text not null default '',
  stc_name     text not null default '',
  hold_minutes int not null default 15 check (hold_minutes between 5 and 120),
  referee_fee  numeric not null default 150 check (referee_fee >= 0),
  filming_fee  numeric not null default 300 check (filming_fee >= 0),
  live_fee     numeric not null default 100 check (live_fee >= 0),
  clip_price   numeric not null default 15 check (clip_price >= 0)
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  pitch       text not null,
  area        text not null default '',
  map_url     text not null default '',
  starts_at   timestamptz not null,
  duration_minutes int not null default 60 check (duration_minutes between 30 and 180),
  format      int not null check (format in (5, 6, 7, 8, 11)),
  price       numeric not null check (price >= 0),
  referee     boolean not null default false,
  filming     boolean not null default false,
  live        boolean not null default false,
  youtube_url text not null default '',
  status      text not null default 'open' check (status in ('open', 'cancelled')),
  created_at  timestamptz not null default now()
);

create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  team        int not null check (team in (1, 2)),
  position    text not null check (position in ('GK', 'DEF', 'MID', 'FWD')),
  player_name text not null,
  phone       text not null,
  clip        boolean not null default false,
  amount      numeric not null,
  code        text not null unique,
  status      text not null default 'held'
              check (status in ('held', 'paid', 'confirmed', 'rejected', 'cancelled')),
  payer_ref   text not null default '',
  expires_at  timestamptz not null,
  paid_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists bookings_match_idx on public.bookings (match_id);
create index if not exists bookings_status_idx on public.bookings (status);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ---------------------------------------------------------------- rules

create or replace function public.position_capacity(p_format int, p_position text)
returns int language sql immutable as $$
  select case p_format
    when 5  then case p_position when 'GK' then 1 when 'DEF' then 2 when 'MID' then 1 when 'FWD' then 1 else 0 end
    when 6  then case p_position when 'GK' then 1 when 'DEF' then 2 when 'MID' then 2 when 'FWD' then 1 else 0 end
    when 7  then case p_position when 'GK' then 1 when 'DEF' then 2 when 'MID' then 2 when 'FWD' then 2 else 0 end
    when 8  then case p_position when 'GK' then 1 when 'DEF' then 3 when 'MID' then 2 when 'FWD' then 2 else 0 end
    when 11 then case p_position when 'GK' then 1 when 'DEF' then 4 when 'MID' then 4 when 'FWD' then 2 else 0 end
    else 0 end
$$;

-- A booking holds its place while waiting for the transfer, while the admin
-- checks a reported transfer, and once confirmed.
create or replace function public.booking_active(p_status text, p_expires timestamptz)
returns boolean language sql stable as $$
  select p_status in ('paid', 'confirmed') or (p_status = 'held' and p_expires > now())
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- ---------------------------------------------------------------- player API

-- Upcoming open matches with how many places are taken.
create or replace function public.match_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
           to_jsonb(m) || jsonb_build_object('taken',
             (select count(*) from bookings b
               where b.match_id = m.id and booking_active(b.status, b.expires_at)))
           order by m.starts_at), '[]'::jsonb)
  from matches m
  where m.status = 'open' and m.starts_at > now()
$$;

-- Which team/position places are taken in one match (no names or phones).
create or replace function public.match_slots(p_match uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('team', b.team, 'position', b.position)), '[]'::jsonb)
  from bookings b
  where b.match_id = p_match and booking_active(b.status, b.expires_at)
$$;

create or replace function public.book_slot(
  p_match uuid, p_team int, p_position text, p_name text, p_phone text, p_clip boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m matches;
  s settings;
  n int;
  amt numeric;
  c text;
  exp timestamptz;
begin
  -- Lock the match row so two players cannot take the last place at once.
  select * into m from matches where id = p_match for update;
  if not found or m.status <> 'open' then raise exception 'match_closed'; end if;
  if m.starts_at <= now() then raise exception 'match_started'; end if;
  if p_team not in (1, 2) then raise exception 'bad_team'; end if;
  if position_capacity(m.format, p_position) = 0 then raise exception 'bad_position'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 40 then raise exception 'bad_name'; end if;
  if coalesce(p_phone, '') !~ '^05[0-9]{8}$' then raise exception 'bad_phone'; end if;

  if (select count(*) from bookings b
       where b.match_id = p_match and b.team = p_team and b.position = p_position
         and booking_active(b.status, b.expires_at)) >= position_capacity(m.format, p_position) then
    raise exception 'slot_taken';
  end if;
  if exists (select 1 from bookings b
              where b.match_id = p_match and b.phone = p_phone and booking_active(b.status, b.expires_at)) then
    raise exception 'already_booked';
  end if;

  select * into s from settings where id = 1;
  n := m.format * 2;
  amt := m.price
       + case when m.referee then ceil(s.referee_fee / n) else 0 end
       + case when m.filming then ceil(s.filming_fee / n) else 0 end
       + case when m.live    then ceil(s.live_fee / n)    else 0 end
       + case when coalesce(p_clip, false) then s.clip_price else 0 end;

  loop
    -- gen_random_uuid() is built in and uses a strong random source.
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from bookings where code = c);
  end loop;
  exp := now() + make_interval(mins => s.hold_minutes);

  insert into bookings (match_id, team, position, player_name, phone, clip, amount, code, expires_at)
  values (p_match, p_team, p_position, btrim(p_name), p_phone, coalesce(p_clip, false), amt, c, exp);

  return jsonb_build_object('code', c, 'amount', amt, 'expires_at', exp, 'team', p_team, 'position', p_position);
end $$;

-- The player says they transferred: the place stays held until an admin
-- confirms or rejects it.
create or replace function public.submit_payment(p_code text, p_ref text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if char_length(btrim(coalesce(p_ref, ''))) not between 2 and 60 then raise exception 'bad_ref'; end if;
  update bookings
     set status = 'paid', payer_ref = btrim(p_ref), paid_at = now()
   where code = upper(p_code) and status = 'held' and expires_at > now();
  if not found then raise exception 'expired'; end if;
end $$;

-- Status of the player's own bookings, looked up by their booking codes.
create or replace function public.booking_status(p_codes text[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', b.code,
           'status', case when b.status = 'held' and b.expires_at <= now() then 'expired' else b.status end,
           'amount', b.amount, 'team', b.team, 'position', b.position, 'clip', b.clip,
           'player_name', b.player_name, 'expires_at', b.expires_at,
           'match', to_jsonb(m)) order by m.starts_at desc), '[]'::jsonb)
  from bookings b join matches m on m.id = b.match_id
  where b.code = any (p_codes[1:50])
$$;

-- ---------------------------------------------------------------- access

alter table public.settings enable row level security;
alter table public.matches  enable row level security;
alter table public.bookings enable row level security;
alter table public.admins   enable row level security;

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select using (true);
drop policy if exists matches_admin on public.matches;
create policy matches_admin on public.matches for all using (public.is_admin()) with check (public.is_admin());

-- Bookings hold names and phone numbers: admins only.
drop policy if exists bookings_admin on public.bookings;
create policy bookings_admin on public.bookings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select using (user_id = auth.uid());

revoke all on function public.book_slot(uuid, int, text, text, text, boolean) from public;
revoke all on function public.submit_payment(text, text) from public;
revoke all on function public.booking_status(text[]) from public;
revoke all on function public.match_slots(uuid) from public;
revoke all on function public.match_list() from public;
grant execute on function public.book_slot(uuid, int, text, text, text, boolean) to anon, authenticated;
grant execute on function public.submit_payment(text, text) to anon, authenticated;
grant execute on function public.booking_status(text[]) to anon, authenticated;
grant execute on function public.match_slots(uuid) to anon, authenticated;
grant execute on function public.match_list() to anon, authenticated;
