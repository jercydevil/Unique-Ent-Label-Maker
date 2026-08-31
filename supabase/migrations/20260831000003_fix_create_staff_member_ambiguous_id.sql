-- =====================================================================
-- Fix ambiguous id return in create_staff_member RPC
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
declare
  v_staff_code text := trim(p_staff_code);
  v_display_name text := trim(p_display_name);
begin
  if p_role not in ('admin', 'staff') then
    raise exception 'role must be admin or staff';
  end if;

  if p_pin !~ '^\d{4,6}$' then
    raise exception 'pin must be 4-6 digits';
  end if;

  insert into core.staff (
    auth_user_id,
    staff_code,
    display_name,
    role,
    pin_hash,
    active
  ) values (
    p_auth_user_id,
    v_staff_code,
    v_display_name,
    p_role,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
    true
  );

  return query
  select s.id, s.staff_code, s.display_name, s.role
  from core.staff s
  where s.auth_user_id = p_auth_user_id
    and s.staff_code = v_staff_code
  order by s.created_at desc
  limit 1;
end;
$$;

grant execute on function public.create_staff_member(uuid, text, text, text, text) to service_role, authenticated, anon;
