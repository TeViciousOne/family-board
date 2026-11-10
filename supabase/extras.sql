-- Shared AI summary, AC schedules and morning weather alerts. Run after ai.sql, ac.sql and push.sql.

-- one daily summary per household and language (the ai function reuses it for an hour)
create table if not exists public.ai_summary (
  household_id uuid not null references public.households(id) on delete cascade,
  lang text not null,
  day date not null,
  text text not null,
  at timestamptz not null default now(),
  primary key (household_id, lang)
);
alter table public.ai_summary enable row level security; -- no policies: only the edge function

-- air conditioner schedules (managed through the ac function, run by the reminders function)
create table if not exists public.ac_schedules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  at text not null check (at ~ '^[0-2][0-9]:[0-5][0-9]$'),
  days int[] not null default '{0,1,2,3,4,5,6}',
  action text not null check (action in ('on', 'off')),
  mode text,
  temp int check (temp between 16 and 30),
  enabled boolean not null default true,
  last_run date,
  created_at timestamptz not null default now()
);
create index if not exists ac_schedules_h on public.ac_schedules(household_id);
alter table public.ac_schedules enable row level security; -- no policies: only the edge functions

-- where each phone is (for the morning weather alert) and whether it wants it
alter table public.push_subscriptions add column if not exists lat double precision;
alter table public.push_subscriptions add column if not exists lon double precision;
alter table public.push_subscriptions add column if not exists place text;
alter table public.push_subscriptions add column if not exists wx_alert boolean not null default true;
