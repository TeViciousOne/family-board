-- Phone notifications (Web Push). Run after schema.sql and password_tools.
alter table public.households add column if not exists tz text not null default 'Europe/Tirane';

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  lang text not null default 'en',
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_h on public.push_subscriptions(household_id);

create table if not exists public.push_log (
  key text primary key,
  sent_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.push_log enable row level security; -- no policies: only the service role touches it

drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Keys and schedule. Generate your own VAPID pair (npx web-push generate-vapid-keys) and put the public half in config.js.
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  vapid_public text not null, vapid_private text not null, cron_secret text not null,
  contact text not null default 'family@familyboard.app'
);
alter table public.push_config enable row level security; -- no policies: only the edge function reads it
-- insert into public.push_config(id, vapid_public, vapid_private, cron_secret) values (1, '<public>', '<private>', '<random secret>');

-- Deploy supabase/functions/reminders (verify_jwt off; it checks the x-cron-secret header), then:
-- create extension if not exists pg_cron; create extension if not exists pg_net with schema extensions;
-- select cron.schedule('family-board-reminders', '* * * * *', $$
--   select net.http_post(url := 'https://<project>.supabase.co/functions/v1/reminders',
--     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select cron_secret from public.push_config where id=1)),
--     body := '{}'::jsonb); $$);

-- Chore templates (editable by the family). Run once.
create table if not exists public.chore_templates (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  emoji text not null default '',
  rule jsonb not null,
  due_time text,
  created_at timestamptz not null default now()
);
create index if not exists chore_templates_h on public.chore_templates(household_id);
alter table public.chore_templates enable row level security;
drop policy if exists chore_templates_all on public.chore_templates;
create policy chore_templates_all on public.chore_templates for all to authenticated
  using (household_id in (select public.my_household_ids())) with check (household_id in (select public.my_household_ids()));
grant select, insert, update, delete on public.chore_templates to authenticated;
alter table public.chore_templates replica identity full;
alter publication supabase_realtime add table public.chore_templates;
alter table public.chore_templates add column if not exists title_sq text;

-- Activity notifications ("chore done by X", "new chore"): triggers queue rows, the reminders function sends them.
create table if not exists public.push_events (
  id bigserial primary key,
  household_id uuid not null,
  kind text not null check (kind in ('done','added')),
  ref uuid not null,
  actor uuid default auth.uid(),
  created_at timestamptz not null default now(),
  sent boolean not null default false
);
alter table public.push_events enable row level security;
-- (see the push_activity_events migration for queue_push_event() and the triggers on chore_completions / chores)
