-- Cross-schema lookup for label scans so staff can scan labels generated in either production or sandbox mode.
create or replace function public.lookup_label_details(p_label_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, core, sandbox
as $$
declare
  v_result jsonb;
begin
  select row_to_json(t) into v_result
  from (
    (
      select l.id, l.label_code, l.status, l.batch_id, l.product_id,
             p.label_heading, p.size_mm, p.color, p.sku,
             b.qty_per_label, b.batch_code,
             'core'::text as source_schema
      from core.labels l
      join core.products p on p.id = l.product_id
      join core.batches b on b.id = l.batch_id
      where l.label_code = p_label_code
      limit 1
    )
    union all
    (
      select l.id, l.label_code, l.status, l.batch_id, l.product_id,
             p.label_heading, p.size_mm, p.color, p.sku,
             b.qty_per_label, b.batch_code,
             'sandbox'::text as source_schema
      from sandbox.labels l
      join sandbox.products p on p.id = l.product_id
      join sandbox.batches b on b.id = l.batch_id
      where l.label_code = p_label_code
      limit 1
    )
  ) t
  limit 1;

  return v_result;
end;
$$;

grant execute on function public.lookup_label_details(text) to anon, authenticated, service_role;
