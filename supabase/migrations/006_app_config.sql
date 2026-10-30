-- Key/value remote config read by src/utils/remoteConfig.js and forceUpdate.js.
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

alter table public.app_config enable row level security;

drop policy if exists "app_config_public_read" on public.app_config;
create policy "app_config_public_read"
  on public.app_config for select
  to anon, authenticated
  using (true);

-- Admin panel writes the min_*_version / update_message rows.
drop policy if exists "admin_all_app_config" on public.app_config;
create policy "admin_all_app_config"
  on public.app_config for all
  to authenticated
  using (is_admin())
  with check (is_admin());

insert into public.app_config (key, value) values
  ('min_android_version', '0'),
  ('min_ios_version',     '0'),
  ('update_message',      'A newer version is required to continue.')
on conflict (key) do nothing;
