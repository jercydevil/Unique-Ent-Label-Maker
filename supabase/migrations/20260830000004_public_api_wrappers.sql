-- =====================================================================
-- Public API wrappers for RPCs, queries and Test Mode switching
-- =====================================================================

create or replace function public.record_delivery(
  p_label_code text,
  p_client_name text,
  p_qty integer,
  p_client_tx_uuid uuid,
  p_occurred_at timestamptz,
  p_device_id text default null,
  p_is_sandbox boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, core, sandbox
as $$
begin
  if p_is_sandbox then
    return sandbox.record_delivery(p_label_code, p_client_name, p_qty, p_client_tx_uuid, p_occurred_at, p_device_id);
  else
    return core.record_delivery(p_label_code, p_client_name, p_qty, p_client_tx_uuid, p_occurred_at, p_device_id);
  end if;
end;
$$;

create or replace function public.create_batch_and_labels(
  p_product_id uuid,
  p_qty_per_label integer,
  p_label_count integer,
  p_is_sandbox boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public, core, sandbox
as $$
begin
  if p_is_sandbox then
    return sandbox.create_batch_and_labels(p_product_id, p_qty_per_label, p_label_count);
  else
    return core.create_batch_and_labels(p_product_id, p_qty_per_label, p_label_count);
  end if;
end;
$$;

create or replace function public.admin_set_label_status(
  p_label_code text,
  p_status text,
  p_reason text,
  p_is_sandbox boolean default false
) returns void
language plpgsql
security definer
set search_path = public, core, sandbox
as $$
begin
  if p_is_sandbox then
    perform sandbox.admin_set_label_status(p_label_code, p_status, p_reason);
  else
    perform core.admin_set_label_status(p_label_code, p_status, p_reason);
  end if;
end;
$$;

create or replace function public.admin_void_transaction(
  p_transaction_id uuid,
  p_reason text,
  p_is_sandbox boolean default false
) returns void
language plpgsql
security definer
set search_path = public, core, sandbox
as $$
begin
  perform core.admin_void_transaction(p_transaction_id, p_reason);
end;
$$;

create or replace function public.admin_correct_transaction(
  p_transaction_id uuid,
  p_field text,
  p_new_value text,
  p_reason text,
  p_is_sandbox boolean default false
) returns void
language plpgsql
security definer
set search_path = public, core, sandbox
as $$
begin
  perform core.admin_correct_transaction(p_transaction_id, p_field, p_new_value, p_reason);
end;
$$;

create or replace function public.reset_test_data() returns void
language plpgsql
security definer
set search_path = public, core, sandbox
as $$
begin
  perform sandbox.reset_test_data();
end;
$$;

create or replace function public.get_products(p_is_sandbox boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, core, sandbox
as $$
declare
  v_res jsonb;
begin
  if p_is_sandbox then
    select coalesce(jsonb_agg(to_jsonb(p) order by p.size_mm, p.label_heading), '[]'::jsonb)
    into v_res from sandbox.products p where p.active = true;
  else
    select coalesce(jsonb_agg(to_jsonb(p) order by p.size_mm, p.label_heading), '[]'::jsonb)
    into v_res from core.products p where p.active = true;
  end if;
  return v_res;
end;
$$;

create or replace function public.get_clients(p_is_sandbox boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, core, sandbox
as $$
declare
  v_res jsonb;
begin
  if p_is_sandbox then
    select coalesce(jsonb_agg(to_jsonb(c) order by c.name), '[]'::jsonb)
    into v_res from sandbox.clients c where c.active = true;
  else
    select coalesce(jsonb_agg(to_jsonb(c) order by c.name), '[]'::jsonb)
    into v_res from core.clients c where c.active = true;
  end if;
  return v_res;
end;
$$;

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
      select tx.*, p.label_heading, p.size_mm, p.color, c.name as client_name, s.display_name as staff_name, l.label_code
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
      select tx.*, p.label_heading, p.size_mm, p.color, c.name as client_name, s.display_name as staff_name, l.label_code
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

create or replace function public.get_batches(p_is_sandbox boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, core, sandbox
as $$
declare
  v_res jsonb;
begin
  if p_is_sandbox then
    select coalesce(jsonb_agg(row_to_json(b) order by b.created_at desc), '[]'::jsonb)
    into v_res
    from (
      select bt.*, p.label_heading, p.size_mm, p.color, s.display_name as creator_name,
        (select count(*) from sandbox.labels l where l.batch_id = bt.id and l.status = 'used') as used_count
      from sandbox.batches bt
      join sandbox.products p on p.id = bt.product_id
      join core.staff s on s.id = bt.created_by
    ) b;
  else
    select coalesce(jsonb_agg(row_to_json(b) order by b.created_at desc), '[]'::jsonb)
    into v_res
    from (
      select bt.*, p.label_heading, p.size_mm, p.color, s.display_name as creator_name,
        (select count(*) from core.labels l where l.batch_id = bt.id and l.status = 'used') as used_count
      from core.batches bt
      join core.products p on p.id = bt.product_id
      join core.staff s on s.id = bt.created_by
    ) b;
  end if;
  return v_res;
end;
$$;

create or replace function public.get_batch_labels(p_batch_id uuid, p_is_sandbox boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, core, sandbox
as $$
declare
  v_res jsonb;
begin
  if p_is_sandbox then
    select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at asc), '[]'::jsonb)
    into v_res from sandbox.labels l where l.batch_id = p_batch_id;
  else
    select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at asc), '[]'::jsonb)
    into v_res from core.labels l where l.batch_id = p_batch_id;
  end if;
  return v_res;
end;
$$;

create or replace function public.get_label_details(p_label_code text, p_is_sandbox boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, core, sandbox
as $$
declare
  v_res jsonb;
begin
  if p_is_sandbox then
    select row_to_json(t) into v_res
    from (
      select l.id, l.label_code, l.status, l.batch_id, l.product_id,
             p.label_heading, p.size_mm, p.color, p.sku,
             b.qty_per_label, b.batch_code
      from sandbox.labels l
      join sandbox.products p on p.id = l.product_id
      join sandbox.batches b on b.id = l.batch_id
      where l.label_code = p_label_code
    ) t;
  else
    select row_to_json(t) into v_res
    from (
      select l.id, l.label_code, l.status, l.batch_id, l.product_id,
             p.label_heading, p.size_mm, p.color, p.sku,
             b.qty_per_label, b.batch_code
      from core.labels l
      join core.products p on p.id = l.product_id
      join core.batches b on b.id = l.batch_id
      where l.label_code = p_label_code
    ) t;
  end if;
  return v_res;
end;
$$;

grant execute on all functions in schema public to anon, authenticated, service_role;
