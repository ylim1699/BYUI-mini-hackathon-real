-- Run after 001_init.sql. Adds Outlook, review details from the prototype, syllabus files,
-- and a site-wide AI cap (people can start a new anonymous session any time).

-- Outlook connection (backend only, encrypted)
alter table public.connections add column if not exists ms_refresh_enc text;
alter table public.connections add column if not exists ms_calendar_id text;

-- Review screen details
alter table public.courses add column if not exists notes text;              -- "Credits aren't listed. Using 3."
alter table public.courses add column if not exists late_policy text;        -- "Loses 5% a day"
alter table public.courses add column if not exists source_lines jsonb not null default '[]'; -- [{text, highlight}]
alter table public.courses add column if not exists file_name text;
alter table public.courses add column if not exists renamed boolean not null default false;
alter table public.items add column if not exists edited boolean not null default false;

-- Syllabus files shown on Add classes (the PDF itself is never uploaded, only its name and result)
create table if not exists public.syllabus_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  name text not null,
  status text not null default '',
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.syllabus_files enable row level security;
drop policy if exists "own rows" on public.syllabus_files;
create policy "own rows" on public.syllabus_files for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Site-wide AI counter (backend only)
create table if not exists public.ai_usage_global (
  day date primary key,
  count int not null default 0
);
alter table public.ai_usage_global enable row level security;

create or replace function public.bump_ai_global(p_day date)
returns int language sql security definer set search_path = public as $$
  insert into public.ai_usage_global (day, count) values (p_day, 1)
  on conflict (day) do update set count = public.ai_usage_global.count + 1
  returning count;
$$;
revoke all on function public.bump_ai_global(date) from public, anon, authenticated;
