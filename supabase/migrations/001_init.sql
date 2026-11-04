-- Syllabus Planner schema. Run in Supabase: SQL Editor > New query > paste > Run.
-- Every table has row-level security (RLS) so a signed-in user can only touch their own rows.

create extension if not exists "pgcrypto";

-- Encrypted third-party credentials. No client policies at all:
-- only the backend (service role key) can read or write this table.
create table if not exists public.connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  canvas_base_url text,
  canvas_token_enc text,
  canvas_ics_enc text,
  google_refresh_enc text,
  google_calendar_id text,
  updated_at timestamptz not null default now()
);
alter table public.connections enable row level security;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  canvas_id text,
  code text not null,
  name text not null default '',
  color text not null default 'c1',
  credits numeric not null default 3,
  hours_per_week numeric not null default 7.5,
  online boolean,                       -- null = not answered yet
  meetings jsonb not null default '[]', -- [{day:1,start:"09:45",end:"10:45"}]
  confirmed boolean not null default false,
  source text not null default 'canvas' check (source in ('canvas', 'syllabus', 'manual')),
  created_at timestamptz not null default now(),
  unique (user_id, canvas_id)
);
alter table public.courses enable row level security;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  canvas_id text,
  title text not null,
  type text not null default 'assignment'
    check (type in ('assignment', 'quiz', 'exam', 'project', 'reading', 'other')),
  due_at timestamptz,
  estimated_hours numeric not null default 1,
  source text not null default 'canvas' check (source in ('canvas', 'syllabus', 'manual')),
  confidence numeric not null default 1,
  status text not null default 'todo' check (status in ('todo', 'done')),
  notes text,
  deleted_at timestamptz,               -- soft delete; purged after 1 day
  google_event_id text,
  created_at timestamptz not null default now(),
  unique (user_id, course_id, canvas_id)
);
alter table public.items enable row level security;
create index if not exists items_user_due on public.items (user_id, due_at);

create table if not exists public.study_times (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null check (end_time > start_time)
);
alter table public.study_times enable row level security;

-- "Studying for" links between one study block occurrence and an item
create table if not exists public.block_links (
  user_id uuid not null references auth.users (id) on delete cascade,
  block_key text not null,  -- "2026-11-03|18:00|<course id>" = date | start time | class
  item_id uuid not null references public.items (id) on delete cascade,
  primary key (user_id, block_key, item_id)
);
alter table public.block_links enable row level security;

create table if not exists public.reminder_rules (
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  offsets_minutes int[] not null,
  primary key (user_id, type)
);
alter table public.reminder_rules enable row level security;

-- AI call counter for the daily limit (backend only)
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;

-- Owner-only policies for tables the browser may read directly
do $$
declare t text;
begin
  foreach t in array array['courses', 'items', 'study_times', 'block_links', 'reminder_rules'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- Atomic counter used by the backend's rate limiter
create or replace function public.bump_ai_usage(p_user uuid, p_day date)
returns int language sql security definer set search_path = public as $$
  insert into public.ai_usage (user_id, day, count) values (p_user, p_day, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count;
$$;
revoke all on function public.bump_ai_usage(uuid, date) from public, anon, authenticated;
