-- =====================================================================
-- Include each transaction's actual product type in the public ledger RPC
-- so the Sales Ledger shows CH / PD / IND correctly instead of a fallback
-- =====================================================================

create or replace function public.get_transactions(p_is_sandbox boolean default false, p_limit int default 100)
returns jsonb
language plpgsql
security definer
set search_path = public, core, sandbox
as $$
declare
  v_res jsonb;
  v_role text := core.current_role();
  v_staff_id uuid := core.current_staff_id();
begin
  if p_is_sandbox then
    select coalesce(jsonb_agg(row_to_json(t) order by t.occurred_at desc), '[]'::jsonb)
    into v_res
    from (
      select tx.*, p.label_heading, p.size_mm, p.color, p.product_type, c.name as client_name, s.display_name as staff_name, l.label_code
      from sandbox.transactions tx
      join sandbox.products p on p.id = tx.product_id
      join sandbox.clients c on c.id = tx.client_id
      join sandbox.labels l on l.id = tx.label_id
      join core.staff s on s.id = tx.staff_id
      where (v_role = 'admin' or tx.staff_id = v_staff_id)
      limit p_limit
    ) t;
  else
    select coalesce(jsonb_agg(row_to_json(t) order by t.occurred_at desc), '[]'::jsonb)
    into v_res
    from (
      select tx.*, p.label_heading, p.size_mm, p.color, p.product_type, c.name as client_name, s.display_name as staff_name, l.label_code
      from core.transactions tx
      join core.products p on p.id = tx.product_id
      join core.clients c on c.id = tx.client_id
      join core.labels l on l.id = tx.label_id
      join core.staff s on s.id = tx.staff_id
      where (v_role = 'admin' or tx.staff_id = v_staff_id)
      limit p_limit
    ) t;
  end if;
  return v_res;
end;
$$;
