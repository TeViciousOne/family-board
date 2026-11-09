-- AI features (quick add, daily summary, shopping tidy-up). Run once, then deploy supabase/functions/ai (verify_jwt off: it checks the user itself).
create table if not exists public.ai_config (
  id int primary key default 1 check (id = 1),
  gemini_key text not null,
  model text not null default 'gemini-3.5-flash'
);
alter table public.ai_config enable row level security; -- no policies: only the edge function reads it
-- insert into public.ai_config(id, gemini_key) values (1, '<your Google AI Studio key>');

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  n integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
alter table public.shopping_items add column if not exists category text;
