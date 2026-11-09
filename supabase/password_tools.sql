-- Password tools: recovery code, reset with code, and "set a new password for a family member".
-- Run after schema.sql.
create table if not exists public.recovery_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text not null,
  attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
alter table public.recovery_codes enable row level security; -- no policies: only the functions below touch it

create or replace function public.make_recovery_code() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare raw text; code text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  raw := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  code := substr(raw,1,4) || '-' || substr(raw,5,4) || '-' || substr(raw,9,4) || '-' || substr(raw,13,4);
  insert into recovery_codes(user_id, code_hash, attempts, locked_until)
  values (auth.uid(), crypt(raw, gen_salt('bf', 10)), 0, null)
  on conflict (user_id) do update set code_hash = excluded.code_hash, attempts = 0, locked_until = null, created_at = now();
  return code;
end $$;

create or replace function public.reset_member_password(m_id uuid, new_pw text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare tuid uuid; thid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if length(coalesce(new_pw, '')) < 6 then raise exception 'weak_password'; end if;
  select user_id, household_id into tuid, thid from members where id = m_id;
  if tuid is null or thid is null or thid not in (select my_household_ids()) then raise exception 'not allowed'; end if;
  update auth.users set encrypted_password = crypt(new_pw, gen_salt('bf', 10)), updated_at = now() where id = tuid;
  if tuid <> auth.uid() then delete from auth.sessions where user_id = tuid; end if;
  return true;
end $$;

create or replace function public.reset_with_code(p_username text, p_code text, p_new text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid; rc recovery_codes; norm text;
begin
  if length(coalesce(p_new, '')) < 6 then raise exception 'weak_password'; end if;
  select id into uid from auth.users where email = lower(trim(p_username)) || '@familyboard.app';
  if uid is null then perform pg_sleep(0.4); return false; end if;
  select * into rc from recovery_codes where user_id = uid;
  if not found then perform pg_sleep(0.4); return false; end if;
  if rc.locked_until is not null and rc.locked_until > now() then raise exception 'locked'; end if;
  norm := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'));
  if crypt(norm, rc.code_hash) = rc.code_hash then
    update auth.users set encrypted_password = crypt(p_new, gen_salt('bf', 10)), updated_at = now() where id = uid;
    delete from auth.sessions where user_id = uid;
    update recovery_codes set attempts = 0, locked_until = null where user_id = uid;
    return true;
  end if;
  update recovery_codes set
    attempts = case when attempts + 1 >= 5 then 0 else attempts + 1 end,
    locked_until = case when attempts + 1 >= 5 then now() + interval '15 minutes' else null end
  where user_id = uid;
  return false;
end $$;

grant execute on function public.make_recovery_code() to authenticated;
grant execute on function public.reset_member_password(uuid, text) to authenticated;
grant execute on function public.reset_with_code(text, text, text) to anon, authenticated;
