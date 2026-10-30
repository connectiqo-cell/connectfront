-- Client build stamped on every profile fetch (src/utils/forceUpdate.js).
-- Lets the admin panel see the version spread before raising min_*_version.
alter table public.profiles
  add column if not exists app_build    integer,
  add column if not exists app_platform text;
