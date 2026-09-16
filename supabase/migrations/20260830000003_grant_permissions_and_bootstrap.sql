-- =====================================================================
-- Grant full schema/table privileges and bootstrap admin user
-- =====================================================================

-- Grant schema permissions
grant usage, create on schema core to postgres, service_role, authenticated, anon;
grant usage, create on schema sandbox to postgres, service_role, authenticated, anon;

-- Grant table & sequence permissions
grant all on all tables in schema core to postgres, service_role, authenticated, anon;
grant all on all tables in schema sandbox to postgres, service_role, authenticated, anon;
grant all on all sequences in schema core to postgres, service_role, authenticated, anon;
grant all on all sequences in schema sandbox to postgres, service_role, authenticated, anon;
grant all on all routines in schema core to postgres, service_role, authenticated, anon;
grant all on all routines in schema sandbox to postgres, service_role, authenticated, anon;

-- Set default privileges for future objects
alter default privileges in schema core grant all on tables to postgres, service_role, authenticated, anon;
alter default privileges in schema core grant all on sequences to postgres, service_role, authenticated, anon;
alter default privileges in schema core grant all on routines to postgres, service_role, authenticated, anon;

alter default privileges in schema sandbox grant all on tables to postgres, service_role, authenticated, anon;
alter default privileges in schema sandbox grant all on sequences to postgres, service_role, authenticated, anon;
alter default privileges in schema sandbox grant all on routines to postgres, service_role, authenticated, anon;

-- Bootstrap the initial admin staff row only if the matching auth user exists.
-- This keeps local Supabase startup working on a fresh database, where the
-- auth user must be created manually before the staff row can reference it.
insert into core.staff (
  auth_user_id,
  staff_code,
  display_name,
  role,
  pin_hash,
  active
)
select
  'b225514c-3fca-4e74-9708-6efcbcb1c3b6'::uuid,
  'admin1',
  'Admin',
  'admin',
  extensions.crypt('1234', extensions.gen_salt('bf', 10)),
  true
where exists (
  select 1 from auth.users where id = 'b225514c-3fca-4e74-9708-6efcbcb1c3b6'::uuid
)
on conflict (staff_code) do update
set auth_user_id = excluded.auth_user_id,
    display_name = excluded.display_name,
    role = excluded.role,
    pin_hash = excluded.pin_hash,
    active = excluded.active;
