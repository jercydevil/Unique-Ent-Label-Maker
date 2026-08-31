-- =====================================================================
-- Fix the canonical staff creation RPC used by admin-create-staff
-- =====================================================================

drop function if exists public.create_staff_member(uuid, text, text, text, text);

create or replace function public.create_staff_member(
  p_auth_user_id uuid,
  p_staff_code text,
  p_display_name text,
  p_role text,
  p_pin text
)
returns table (
  id uuid,
  staff_code text,
  display_name text,
  role text
)
language plpgsql
security definer
set search_path = public, core, extensions
as $$
begin
  if p_role not in ('admin', 'staff') then
    raise exception 'role must be admin or staff';
  end if;

  if p_pin !~ '^\d{4,6}$' then
    raise exception 'pin must be 4-6 digits';
  end if;

  return query
  insert into core.staff (
    auth_user_id,
    staff_code,
    display_name,
    role,
    pin_hash,
    active
  ) values (
    p_auth_user_id,
    trim(p_staff_code),
    trim(p_display_name),
    p_role,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
    true
  )
  returning id, staff_code, display_name, role;
end;
$$;

grant execute on function public.create_staff_member(uuid, text, text, text, text) to service_role, authenticated, anon;
