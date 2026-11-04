-- Run after 002. Lets a class be deleted (kept in Recently deleted for 1 day, then removed for good).
alter table public.courses add column if not exists deleted_at timestamptz;
