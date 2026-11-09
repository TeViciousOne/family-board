-- Family Board schema. Paste this whole file into Supabase > SQL Editor > Run.
-- Safe to re-run: it drops and recreates policies and functions, but never drops tables or data.

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Home',
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  color text not null default '#2F86D0',
  emoji text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.chores (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  emoji text not null default '',
  member_id uuid references public.members(id) on delete set null,
  rule jsonb not null,
  due_time text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chore_completions (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  chore_id uuid not null references public.chores(id) on delete cascade,
  on_date date not null,
  done_by uuid references public.members(id) on delete set null,
  done_at timestamptz not null default now(),
  unique (chore_id, on_date)
);

create table if not exists public.events (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  kind text not null default 'event',
  on_date date not null,
  end_date date,
  all_day boolean not null default true,
  start_time text,
  end_time text,
  member_id uuid references public.members(id) on delete set null,
  rule jsonb,
  remind_minutes integer,
  birth_year integer,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  added_by uuid references public.members(id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  body text not null,
  author uuid references public.members(id) on delete set null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists chores_h on public.chores(household_id);
create index if not exists completions_h on public.chore_completions(household_id, on_date);
create index if not exists events_h on public.events(household_id);
create index if not exists shopping_h on public.shopping_items(household_id);
create index if not exists notes_h on public.notes(household_id, created_at desc);
create index if not exists members_h on public.members(household_id);

-- ---------- helper: which households does the caller belong to ----------
create or replace function public.my_household_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$ select household_id from public.members where user_id = auth.uid() $$;
revoke all on function public.my_household_ids() from public, anon;
grant execute on function public.my_household_ids() to authenticated;

-- ---------- row level security ----------
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.chores enable row level security;
alter table public.chore_completions enable row level security;
alter table public.events enable row level security;
alter table public.shopping_items enable row level security;
alter table public.notes enable row level security;

drop policy if exists hh_select on public.households;
drop policy if exists hh_update on public.households;
create policy hh_select on public.households for select to authenticated using (id in (select public.my_household_ids()));
create policy hh_update on public.households for update to authenticated using (id in (select public.my_household_ids())) with check (id in (select public.my_household_ids()));

-- members: everyone in the household can read, add (people without a login), rename and remove.
drop policy if exists m_select on public.members;
drop policy if exists m_insert on public.members;
drop policy if exists m_update on public.members;
drop policy if exists m_delete on public.members;
create policy m_select on public.members for select to authenticated using (household_id in (select public.my_household_ids()));
create policy m_insert on public.members for insert to authenticated
  with check (household_id in (select public.my_household_ids()) and user_id is null);
create policy m_update on public.members for update to authenticated
  using (household_id in (select public.my_household_ids())) with check (household_id in (select public.my_household_ids()));
create policy m_delete on public.members for delete to authenticated using (household_id in (select public.my_household_ids()));

-- the same rule for every data table
do $$
declare t text;
begin
  foreach t in array array['chores','chore_completions','events','shopping_items','notes'] loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (household_id in (select public.my_household_ids())) with check (household_id in (select public.my_household_ids()))',
      t || '_all', t);
  end loop;
end $$;

-- column-level protection: nobody can re-assign a member to another login or household, or change the household code
revoke update on public.members from authenticated;
grant update (name, color, emoji) on public.members to authenticated;
revoke update on public.households from authenticated;
grant update (name) on public.households to authenticated;
grant select, insert, delete on public.members to authenticated;
grant select on public.households to authenticated;
grant select, insert, update, delete on public.chores, public.chore_completions, public.events, public.shopping_items, public.notes to authenticated;
revoke all on all tables in schema public from anon;

-- ---------- RPCs used by the sign-up screen ----------
create or replace function public.create_household(h_name text, m_name text, m_color text, m_emoji text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare hid uuid; c text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'already in a household'; end if;
  loop
    c := upper(substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=0O1IL', ''), 1, 6));
    exit when length(c) = 6 and not exists (select 1 from households where code = c);
  end loop;
  insert into households(name, code) values (coalesce(nullif(trim(h_name), ''), 'Home'), c) returning id into hid;
  insert into members(household_id, user_id, name, color, emoji) values (hid, auth.uid(), trim(m_name), m_color, coalesce(m_emoji, ''));
  return hid;
end $$;

create or replace function public.join_household(h_code text, m_name text, m_color text, m_emoji text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'already in a household'; end if;
  select id into hid from households where code = upper(trim(h_code));
  if hid is null then raise exception 'invalid_code'; end if;
  insert into members(household_id, user_id, name, color, emoji) values (hid, auth.uid(), trim(m_name), m_color, coalesce(m_emoji, ''));
  return hid;
end $$;

revoke all on function public.create_household(text,text,text,text), public.join_household(text,text,text,text) from public, anon;
grant execute on function public.create_household(text,text,text,text), public.join_household(text,text,text,text) to authenticated;

-- ---------- realtime ----------
do $$
declare t text;
begin
  foreach t in array array['members','chores','chore_completions','events','shopping_items','notes','households'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
alter table public.chore_completions replica identity full;
alter table public.chores replica identity full;
alter table public.events replica identity full;
alter table public.shopping_items replica identity full;
alter table public.notes replica identity full;
alter table public.members replica identity full;
