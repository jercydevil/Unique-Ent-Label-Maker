-- =====================================================================
-- Fix crypt() reference to use extensions schema
-- =====================================================================

create or replace function public.verify_staff_pin(p_staff_code text, p_pin text)
returns table (
  staff_id uuid,
  auth_user_id uuid,
  staff_code text,
  display_name text,
  role text,
  active boolean
)
language plpgsql
security definer
set search_path = core, public, extensions
as $$
begin
  return query
  select s.id, s.auth_user_id, s.staff_code, s.display_name, s.role, s.active
  from core.staff s
  where lower(trim(s.staff_code)) = lower(trim(p_staff_code))
    and s.active = true
    and s.pin_hash = extensions.crypt(p_pin, s.pin_hash);
end;
$$;

grant execute on function public.verify_staff_pin(text, text) to anon, authenticated, service_role;
