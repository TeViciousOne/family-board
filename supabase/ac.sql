-- Air conditioner control (Tuya / Smart Life). Run once, deploy supabase/functions/ac (verify_jwt off: it checks the
-- user itself), then insert your own credentials from the Tuya IoT console (never commit them):
--   insert into public.ac_config(id, access_id, access_secret, device_id) values (1, '<access id>', '<access secret>', '<device id>');
create table if not exists public.ac_config (
  id int primary key default 1 check (id = 1),
  access_id text not null,
  access_secret text not null,
  device_id text not null,
  endpoint text not null default 'https://openapi.tuyaeu.com'
);
alter table public.ac_config enable row level security;
-- no policies: only the edge function (service role) can read it
