-- =====================================================================
-- Unique Enterprise QR Sales Register — full migration (DRAFT FOR REVIEW)
-- Nothing in this repo/session has run this yet. Review, then apply via
-- the Supabase SQL editor or `supabase db push`.
--
-- Stack: React PWA + Supabase (free tier) + IndexedDB offline queue +
--        open-source QR lib + browser PDF generation + Cloudflare
--        Pages/Vercel hosting.
--
-- Locked decisions (confirmed by you):
--   - Labels are one-time-use (blocked from a second confirmed delivery)
--   - Test Mode = separate Postgres schema (`sandbox`), not a data flag
--   - QR encodes a plain URL: https://<domain>/s/<8-char label_code>
--
-- Defaults carried forward (flag if you want these changed):
--   - Label ID alphabet: a-z0-9, no exclusions
--   - QR domain: placeholder https://ue-qr.pages.dev — update before print
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

drop schema if exists core cascade;
drop schema if exists sandbox cascade;

create schema if not exists core;
create schema if not exists sandbox;

-- =====================================================================
-- SECTION 1 — TABLES (core = production), staff table first since the
-- helper functions below (Section 2) reference it.
-- =====================================================================

create table core.staff (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id),
  staff_code    text not null unique,
  display_name  text not null,
  role          text not null check (role in ('admin','staff')),
  pin_hash      text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- =====================================================================
-- SECTION 2 — HELPER FUNCTIONS (role/identity lookups used by RLS + RPCs)
-- =====================================================================

create or replace function core.current_role() returns text
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'anon');
$$;

create or replace function core.current_staff_id() returns uuid
language sql stable as $$
  select id from core.staff where auth_user_id = auth.uid();
$$;

-- =====================================================================
-- SECTION 2b — remaining core tables
-- =====================================================================

create table core.products (
  id              uuid primary key default gen_random_uuid(),
  size_mm         numeric not null,
  color           text not null,
  product_type    text,                       -- CH / PD / IND — internal only
  sku             text unique,
  label_heading   text not null,              -- exact printed text, e.g. "63 MM GOLDEN"
  label_color_hex text not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table core.batches (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references core.products(id),
  batch_code      text not null unique,
  qty_per_label   integer not null check (qty_per_label > 0),
  label_count     integer not null check (label_count > 0),
  created_by      uuid not null references core.staff(id),
  voided          boolean not null default false,
  created_at      timestamptz not null default now()
);

create table core.labels (
  id                 uuid primary key default gen_random_uuid(),
  label_code         text not null unique check (label_code ~ '^[a-z0-9]{8}$'),
  batch_id           uuid not null references core.batches(id),
  product_id         uuid not null references core.products(id),
  status             text not null default 'unused'
                       check (status in ('unused','used','lost','damaged','void')),
  status_reason      text,
  status_changed_by  uuid references core.staff(id),
  status_changed_at  timestamptz,
  printed_at         timestamptz,
  created_at         timestamptz not null default now()
);
create index labels_batch_idx on core.labels(batch_id);

create table core.clients (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  name_normalized text generated always as (lower(trim(name))) stored,
  active          boolean not null default true,
  created_by      uuid references core.staff(id),
  created_at      timestamptz not null default now()
);
create index clients_name_trgm_idx on core.clients using gin (name_normalized gin_trgm_ops);

create table core.transactions (
  id                  uuid primary key default gen_random_uuid(),
  client_tx_uuid      uuid not null unique,
  label_id            uuid not null references core.labels(id),
  product_id          uuid not null references core.products(id),
  batch_id            uuid not null references core.batches(id),
  client_id           uuid not null references core.clients(id),
  qty                 integer not null check (qty > 0),
  staff_id            uuid not null references core.staff(id),
  device_id           text,
  status              text not null default 'confirmed'
                        check (status in ('confirmed','flagged','voided')),
  occurred_at         timestamptz not null,
  server_received_at  timestamptz not null default now(),
  created_at          timestamptz not null default now()
);
create unique index transactions_one_active_per_label
  on core.transactions(label_id) where status = 'confirmed';

create table core.corrections (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references core.transactions(id),
  field_name      text not null,
  old_value       text,
  new_value       text,
  reason          text not null,
  corrected_by    uuid not null references core.staff(id),
  corrected_at    timestamptz not null default now()
);

create table core.audit_log (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  actor_id      uuid,
  actor_role    text,
  action        text not null,
  entity_type   text not null,
  entity_id     text,
  before        jsonb,
  after         jsonb,
  result        text not null
);

-- =====================================================================
-- SECTION 3 — TABLES (sandbox = Test Mode, identical shape, no staff dup)
-- Staff/auth is shared via core.staff; only business data is isolated.
-- =====================================================================

create table sandbox.products (
  id              uuid primary key default gen_random_uuid(),
  size_mm         numeric not null,
  color           text not null,
  product_type    text,
  sku             text unique,
  label_heading   text not null,
  label_color_hex text not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table sandbox.batches (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references sandbox.products(id),
  batch_code      text not null unique,
  qty_per_label   integer not null check (qty_per_label > 0),
  label_count     integer not null check (label_count > 0),
  created_by      uuid not null references core.staff(id),
  voided          boolean not null default false,
  created_at      timestamptz not null default now()
);

create table sandbox.labels (
  id                 uuid primary key default gen_random_uuid(),
  label_code         text not null unique check (label_code ~ '^[a-z0-9]{8}$'),
  batch_id           uuid not null references sandbox.batches(id),
  product_id         uuid not null references sandbox.products(id),
  status             text not null default 'unused'
                       check (status in ('unused','used','lost','damaged','void')),
  status_reason      text,
  status_changed_by  uuid references core.staff(id),
  status_changed_at  timestamptz,
  printed_at         timestamptz,
  created_at         timestamptz not null default now()
);
create index sandbox_labels_batch_idx on sandbox.labels(batch_id);

create table sandbox.clients (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  name_normalized text generated always as (lower(trim(name))) stored,
  active          boolean not null default true,
  created_by      uuid references core.staff(id),
  created_at      timestamptz not null default now()
);
create index sandbox_clients_name_trgm_idx on sandbox.clients using gin (name_normalized gin_trgm_ops);

create table sandbox.transactions (
  id                  uuid primary key default gen_random_uuid(),
  client_tx_uuid      uuid not null unique,
  label_id            uuid not null references sandbox.labels(id),
  product_id          uuid not null references sandbox.products(id),
  batch_id            uuid not null references sandbox.batches(id),
  client_id           uuid not null references sandbox.clients(id),
  qty                 integer not null check (qty > 0),
  staff_id            uuid not null references core.staff(id),
  device_id           text,
  status              text not null default 'confirmed'
                        check (status in ('confirmed','flagged','voided')),
  occurred_at         timestamptz not null,
  server_received_at  timestamptz not null default now(),
  created_at          timestamptz not null default now()
);
create unique index sandbox_transactions_one_active_per_label
  on sandbox.transactions(label_id) where status = 'confirmed';

create table sandbox.corrections (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references sandbox.transactions(id),
  field_name      text not null,
  old_value       text,
  new_value       text,
  reason          text not null,
  corrected_by    uuid not null references core.staff(id),
  corrected_at    timestamptz not null default now()
);

create table sandbox.audit_log (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  actor_id      uuid,
  actor_role    text,
  action        text not null,
  entity_type   text not null,
  entity_id     text,
  before        jsonb,
  after         jsonb,
  result        text not null
);

-- =====================================================================
-- SECTION 4 — IMMUTABILITY TRIGGERS
-- Blanket-reject UPDATE/DELETE on ledger tables, with a narrow,
-- function-only bypass (a transaction-local GUC flag) so the vetted
-- admin RPCs below — and only those — can make a correction/void.
-- Any raw UPDATE/DELETE run by hand (SQL editor, a future buggy script,
-- etc.) is still rejected even by a superuser session.
-- =====================================================================

create or replace function core.reject_mutation() returns trigger as $$
begin
  if current_setting('core.allow_ledger_mutation', true) = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'This table is append-only; % is not permitted', TG_OP;
end;
$$ language plpgsql;

create trigger no_update_audit_core before update on core.audit_log
  for each row execute function core.reject_mutation();
create trigger no_delete_audit_core before delete on core.audit_log
  for each row execute function core.reject_mutation();
create trigger no_update_tx_core before update on core.transactions
  for each row execute function core.reject_mutation();
create trigger no_delete_tx_core before delete on core.transactions
  for each row execute function core.reject_mutation();

create trigger no_update_audit_sandbox before update on sandbox.audit_log
  for each row execute function core.reject_mutation();
create trigger no_delete_audit_sandbox before delete on sandbox.audit_log
  for each row execute function core.reject_mutation();
create trigger no_update_tx_sandbox before update on sandbox.transactions
  for each row execute function core.reject_mutation();
create trigger no_delete_tx_sandbox before delete on sandbox.transactions
  for each row execute function core.reject_mutation();

-- =====================================================================
-- SECTION 5 — ROW LEVEL SECURITY
-- =====================================================================

alter table core.staff enable row level security;
alter table core.products enable row level security;
alter table core.batches enable row level security;
alter table core.labels enable row level security;
alter table core.clients enable row level security;
alter table core.transactions enable row level security;
alter table core.corrections enable row level security;
alter table core.audit_log enable row level security;

alter table sandbox.products enable row level security;
alter table sandbox.batches enable row level security;
alter table sandbox.labels enable row level security;
alter table sandbox.clients enable row level security;
alter table sandbox.transactions enable row level security;
alter table sandbox.corrections enable row level security;
alter table sandbox.audit_log enable row level security;

-- staff: admin sees all, staff sees only their own row. No client-side
-- writes at all — staff records are managed by a service-role admin
-- process (invite/deactivate), not through RLS-governed inserts.
create policy staff_select_admin on core.staff for select
  using (core.current_role() = 'admin');
create policy staff_select_self on core.staff for select
  using (auth_user_id = auth.uid());

-- products (core): everyone authenticated can read; only admin can write.
create policy products_select_all on core.products for select
  using (auth.role() = 'authenticated');
create policy products_admin_insert on core.products for insert
  with check (core.current_role() = 'admin');
create policy products_admin_update on core.products for update
  using (core.current_role() = 'admin');

create policy sandbox_products_select_all on sandbox.products for select
  using (auth.role() = 'authenticated');
create policy sandbox_products_admin_insert on sandbox.products for insert
  with check (core.current_role() = 'admin');
create policy sandbox_products_admin_update on sandbox.products for update
  using (core.current_role() = 'admin');

-- batches: read for all authenticated; writes go through create_batch_and_labels()
-- (SECURITY DEFINER), so no direct insert policy is granted here.
create policy batches_select_all on core.batches for select
  using (auth.role() = 'authenticated');
create policy sandbox_batches_select_all on sandbox.batches for select
  using (auth.role() = 'authenticated');

-- labels: read for all authenticated (needed for scan lookups). All writes
-- (creation, status changes) go through SECURITY DEFINER functions only.
create policy labels_select_all on core.labels for select
  using (auth.role() = 'authenticated');
create policy sandbox_labels_select_all on sandbox.labels for select
  using (auth.role() = 'authenticated');

-- clients: all authenticated can read + create (new client on the fly);
-- only admin can update/deactivate/merge.
create policy clients_select_all on core.clients for select
  using (auth.role() = 'authenticated');
create policy clients_insert_all on core.clients for insert
  with check (auth.role() = 'authenticated');
create policy clients_admin_update on core.clients for update
  using (core.current_role() = 'admin');

create policy sandbox_clients_select_all on sandbox.clients for select
  using (auth.role() = 'authenticated');
create policy sandbox_clients_insert_all on sandbox.clients for insert
  with check (auth.role() = 'authenticated');
create policy sandbox_clients_admin_update on sandbox.clients for update
  using (core.current_role() = 'admin');

-- transactions: staff see only their own; admin sees all. No insert/update/
-- delete policies — all writes go through record_delivery() / admin RPCs.
create policy transactions_select_own on core.transactions for select
  using (staff_id = core.current_staff_id());
create policy transactions_select_admin on core.transactions for select
  using (core.current_role() = 'admin');

create policy sandbox_transactions_select_own on sandbox.transactions for select
  using (staff_id = core.current_staff_id());
create policy sandbox_transactions_select_admin on sandbox.transactions for select
  using (core.current_role() = 'admin');

-- corrections + audit_log: admin read-only. Writes only via SECURITY
-- DEFINER functions (which bypass RLS as the function owner).
create policy corrections_select_admin on core.corrections for select
  using (core.current_role() = 'admin');
create policy audit_select_admin on core.audit_log for select
  using (core.current_role() = 'admin');

create policy sandbox_corrections_select_admin on sandbox.corrections for select
  using (core.current_role() = 'admin');
create policy sandbox_audit_select_admin on sandbox.audit_log for select
  using (core.current_role() = 'admin');

-- =====================================================================
-- SECTION 6 — BUSINESS LOGIC FUNCTIONS (core)
-- =====================================================================

create or replace function core.record_delivery(
  p_label_code text,
  p_client_name text,
  p_qty integer,
  p_client_tx_uuid uuid,
  p_occurred_at timestamptz,
  p_device_id text
) returns jsonb
language plpgsql security definer as $$
declare
  v_staff_id uuid := core.current_staff_id();
  v_label core.labels%rowtype;
  v_client_id uuid;
  v_tx_id uuid;
begin
  if v_staff_id is null then
    raise exception 'Not a recognized staff account';
  end if;

  select id into v_tx_id from core.transactions where client_tx_uuid = p_client_tx_uuid;
  if found then
    return jsonb_build_object('result','ok','transaction_id', v_tx_id, 'replay', true);
  end if;

  select * into v_label from core.labels where label_code = p_label_code for update;
  if not found then
    return jsonb_build_object('result','not_found');
  end if;

  if v_label.status in ('lost','damaged','void') then
    insert into core.audit_log(actor_id, actor_role, action, entity_type, entity_id, result)
      values (auth.uid(), 'staff', 'label.scan', 'label', v_label.id::text, 'blocked');
    return jsonb_build_object('result','blocked', 'reason', v_label.status);
  end if;

  if exists (select 1 from core.transactions
             where label_id = v_label.id and status = 'confirmed') then
    insert into core.audit_log(actor_id, actor_role, action, entity_type, entity_id, result)
      values (auth.uid(), 'staff', 'label.scan', 'label', v_label.id::text, 'duplicate');
    return jsonb_build_object('result','already_processed');
  end if;

  insert into core.clients(name, created_by)
    values (p_client_name, v_staff_id)
    on conflict do nothing;
  select id into v_client_id from core.clients
    where name_normalized = lower(trim(p_client_name)) limit 1;

  insert into core.transactions(
    client_tx_uuid, label_id, product_id, batch_id, client_id,
    qty, staff_id, device_id, occurred_at
  ) values (
    p_client_tx_uuid, v_label.id, v_label.product_id, v_label.batch_id, v_client_id,
    p_qty, v_staff_id, p_device_id, p_occurred_at
  ) returning id into v_tx_id;

  update core.labels set status = 'used', status_changed_by = v_staff_id,
    status_changed_at = now() where id = v_label.id;

  insert into core.audit_log(actor_id, actor_role, action, entity_type, entity_id, after, result)
    values (auth.uid(), 'staff', 'transaction.create', 'transaction', v_tx_id::text,
            jsonb_build_object('label_code', p_label_code, 'qty', p_qty), 'ok');

  return jsonb_build_object('result','ok', 'transaction_id', v_tx_id);
end;
$$;

create or replace function core.create_batch_and_labels(
  p_product_id uuid, p_qty_per_label integer, p_label_count integer
) returns uuid
language plpgsql security definer as $$
declare
  v_staff_id uuid := core.current_staff_id();
  v_batch_id uuid;
  v_batch_code text;
  v_seq int;
  v_code text;
  i int;
begin
  if core.current_role() <> 'admin' then
    raise exception 'Only admin can generate labels';
  end if;

  select coalesce(max(split_part(batch_code,'-',2)::int),0) + 1 into v_seq
    from core.batches where batch_code like 'B' || to_char(now(),'YYMMDD') || '-%';
  v_batch_code := 'B' || to_char(now(),'YYMMDD') || '-' || lpad(v_seq::text,2,'0');

  insert into core.batches(product_id, batch_code, qty_per_label, label_count, created_by)
    values (p_product_id, v_batch_code, p_qty_per_label, p_label_count, v_staff_id)
    returning id into v_batch_id;

  for i in 1..p_label_count loop
    loop
      v_code := array_to_string(array(
        select substr('abcdefghijklmnopqrstuvwxyz0123456789', (floor(random()*36)+1)::int, 1)
        from generate_series(1,8)), '');
      begin
        insert into core.labels(label_code, batch_id, product_id)
          values (v_code, v_batch_id, p_product_id);
        exit;
      exception when unique_violation then
        -- collision (astronomically rare) — loop retries with a new code
      end;
    end loop;
  end loop;

  insert into core.audit_log(actor_id, actor_role, action, entity_type, entity_id, after, result)
    values (auth.uid(), 'admin', 'batch.create', 'batch', v_batch_id::text,
            jsonb_build_object('batch_code', v_batch_code, 'label_count', p_label_count), 'ok');

  return v_batch_id;
end;
$$;

create or replace function core.admin_set_label_status(
  p_label_code text, p_status text, p_reason text
) returns void
language plpgsql security definer as $$
declare
  v_staff_id uuid := core.current_staff_id();
  v_label core.labels%rowtype;
begin
  if core.current_role() <> 'admin' then
    raise exception 'Only admin can change label status';
  end if;
  if p_status not in ('lost','damaged','void','unused') then
    raise exception 'Invalid status';
  end if;

  select * into v_label from core.labels where label_code = p_label_code for update;
  if not found then raise exception 'Label not found'; end if;

  update core.labels set status = p_status, status_reason = p_reason,
    status_changed_by = v_staff_id, status_changed_at = now()
    where id = v_label.id;

  insert into core.audit_log(actor_id, actor_role, action, entity_type, entity_id, before, after, result)
    values (auth.uid(), 'admin', 'label.status_change', 'label', v_label.id::text,
      jsonb_build_object('status', v_label.status),
      jsonb_build_object('status', p_status, 'reason', p_reason), 'ok');
end;
$$;

create or replace function core.admin_void_transaction(
  p_transaction_id uuid, p_reason text
) returns void
language plpgsql security definer as $$
declare
  v_staff_id uuid := core.current_staff_id();
  v_tx core.transactions%rowtype;
begin
  if core.current_role() <> 'admin' then
    raise exception 'Only admin can void a transaction';
  end if;

  select * into v_tx from core.transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if v_tx.status <> 'confirmed' then
    raise exception 'Only a confirmed transaction can be voided';
  end if;

  perform set_config('core.allow_ledger_mutation', 'on', true);
  update core.transactions set status = 'voided' where id = p_transaction_id;
  perform set_config('core.allow_ledger_mutation', 'off', true);

  insert into core.corrections(transaction_id, field_name, old_value, new_value, reason, corrected_by)
    values (p_transaction_id, 'status', 'confirmed', 'voided', p_reason, v_staff_id);

  insert into core.audit_log(actor_id, actor_role, action, entity_type, entity_id, before, after, result)
    values (auth.uid(), 'admin', 'transaction.void', 'transaction', p_transaction_id::text,
      jsonb_build_object('status','confirmed'),
      jsonb_build_object('status','voided','reason',p_reason), 'ok');
end;
$$;

create or replace function core.admin_correct_transaction(
  p_transaction_id uuid, p_field text, p_new_value text, p_reason text
) returns void
language plpgsql security definer as $$
declare
  v_staff_id uuid := core.current_staff_id();
  v_old text;
begin
  if core.current_role() <> 'admin' then
    raise exception 'Only admin can correct a transaction';
  end if;
  if p_field not in ('qty','client_id') then
    raise exception 'Unsupported field for correction: %', p_field;
  end if;

  perform set_config('core.allow_ledger_mutation', 'on', true);
  if p_field = 'qty' then
    select qty::text into v_old from core.transactions where id = p_transaction_id;
    update core.transactions set qty = p_new_value::int where id = p_transaction_id;
  elsif p_field = 'client_id' then
    select client_id::text into v_old from core.transactions where id = p_transaction_id;
    update core.transactions set client_id = p_new_value::uuid where id = p_transaction_id;
  end if;
  perform set_config('core.allow_ledger_mutation', 'off', true);

  insert into core.corrections(transaction_id, field_name, old_value, new_value, reason, corrected_by)
    values (p_transaction_id, p_field, v_old, p_new_value, p_reason, v_staff_id);

  insert into core.audit_log(actor_id, actor_role, action, entity_type, entity_id, before, after, result)
    values (auth.uid(), 'admin', 'transaction.correct', 'transaction', p_transaction_id::text,
      jsonb_build_object(p_field, v_old),
      jsonb_build_object(p_field, p_new_value, 'reason', p_reason), 'ok');
end;
$$;

-- =====================================================================
-- SECTION 7 — SANDBOX MIRROR FUNCTIONS (identical logic, sandbox tables)
-- =====================================================================

create or replace function sandbox.record_delivery(
  p_label_code text, p_client_name text, p_qty integer,
  p_client_tx_uuid uuid, p_occurred_at timestamptz, p_device_id text
) returns jsonb
language plpgsql security definer as $$
declare
  v_staff_id uuid := core.current_staff_id();
  v_label sandbox.labels%rowtype;
  v_client_id uuid;
  v_tx_id uuid;
begin
  if v_staff_id is null then raise exception 'Not a recognized staff account'; end if;

  select id into v_tx_id from sandbox.transactions where client_tx_uuid = p_client_tx_uuid;
  if found then
    return jsonb_build_object('result','ok','transaction_id', v_tx_id, 'replay', true);
  end if;

  select * into v_label from sandbox.labels where label_code = p_label_code for update;
  if not found then return jsonb_build_object('result','not_found'); end if;

  if v_label.status in ('lost','damaged','void') then
    insert into sandbox.audit_log(actor_id, actor_role, action, entity_type, entity_id, result)
      values (auth.uid(), 'staff', 'label.scan', 'label', v_label.id::text, 'blocked');
    return jsonb_build_object('result','blocked', 'reason', v_label.status);
  end if;

  if exists (select 1 from sandbox.transactions
             where label_id = v_label.id and status = 'confirmed') then
    insert into sandbox.audit_log(actor_id, actor_role, action, entity_type, entity_id, result)
      values (auth.uid(), 'staff', 'label.scan', 'label', v_label.id::text, 'duplicate');
    return jsonb_build_object('result','already_processed');
  end if;

  insert into sandbox.clients(name, created_by) values (p_client_name, v_staff_id)
    on conflict do nothing;
  select id into v_client_id from sandbox.clients
    where name_normalized = lower(trim(p_client_name)) limit 1;

  insert into sandbox.transactions(
    client_tx_uuid, label_id, product_id, batch_id, client_id,
    qty, staff_id, device_id, occurred_at
  ) values (
    p_client_tx_uuid, v_label.id, v_label.product_id, v_label.batch_id, v_client_id,
    p_qty, v_staff_id, p_device_id, p_occurred_at
  ) returning id into v_tx_id;

  update sandbox.labels set status = 'used', status_changed_by = v_staff_id,
    status_changed_at = now() where id = v_label.id;

  insert into sandbox.audit_log(actor_id, actor_role, action, entity_type, entity_id, after, result)
    values (auth.uid(), 'staff', 'transaction.create', 'transaction', v_tx_id::text,
            jsonb_build_object('label_code', p_label_code, 'qty', p_qty), 'ok');

  return jsonb_build_object('result','ok', 'transaction_id', v_tx_id);
end;
$$;

create or replace function sandbox.create_batch_and_labels(
  p_product_id uuid, p_qty_per_label integer, p_label_count integer
) returns uuid
language plpgsql security definer as $$
declare
  v_staff_id uuid := core.current_staff_id();
  v_batch_id uuid;
  v_batch_code text;
  v_seq int;
  v_code text;
  i int;
begin
  if core.current_role() <> 'admin' then raise exception 'Only admin can generate labels'; end if;

  select coalesce(max(split_part(batch_code,'-',2)::int),0) + 1 into v_seq
    from sandbox.batches where batch_code like 'T' || to_char(now(),'YYMMDD') || '-%';
  v_batch_code := 'T' || to_char(now(),'YYMMDD') || '-' || lpad(v_seq::text,2,'0');

  insert into sandbox.batches(product_id, batch_code, qty_per_label, label_count, created_by)
    values (p_product_id, v_batch_code, p_qty_per_label, p_label_count, v_staff_id)
    returning id into v_batch_id;

  for i in 1..p_label_count loop
    loop
      v_code := array_to_string(array(
        select substr('abcdefghijklmnopqrstuvwxyz0123456789', (floor(random()*36)+1)::int, 1)
        from generate_series(1,8)), '');
      begin
        insert into sandbox.labels(label_code, batch_id, product_id)
          values (v_code, v_batch_id, p_product_id);
        exit;
      exception when unique_violation then
        -- retry
      end;
    end loop;
  end loop;

  insert into sandbox.audit_log(actor_id, actor_role, action, entity_type, entity_id, after, result)
    values (auth.uid(), 'admin', 'batch.create', 'batch', v_batch_id::text,
            jsonb_build_object('batch_code', v_batch_code, 'label_count', p_label_count), 'ok');

  return v_batch_id;
end;
$$;

create or replace function sandbox.admin_set_label_status(
  p_label_code text, p_status text, p_reason text
) returns void
language plpgsql security definer as $$
declare
  v_staff_id uuid := core.current_staff_id();
  v_label sandbox.labels%rowtype;
begin
  if core.current_role() <> 'admin' then raise exception 'Only admin can change label status'; end if;
  if p_status not in ('lost','damaged','void','unused') then raise exception 'Invalid status'; end if;

  select * into v_label from sandbox.labels where label_code = p_label_code for update;
  if not found then raise exception 'Label not found'; end if;

  update sandbox.labels set status = p_status, status_reason = p_reason,
    status_changed_by = v_staff_id, status_changed_at = now()
    where id = v_label.id;

  insert into sandbox.audit_log(actor_id, actor_role, action, entity_type, entity_id, before, after, result)
    values (auth.uid(), 'admin', 'label.status_change', 'label', v_label.id::text,
      jsonb_build_object('status', v_label.status),
      jsonb_build_object('status', p_status, 'reason', p_reason), 'ok');
end;
$$;

create or replace function sandbox.reset_test_data() returns void
language plpgsql security definer as $$
begin
  if core.current_role() <> 'admin' then
    raise exception 'Only admin can reset test data';
  end if;
  truncate sandbox.transactions, sandbox.corrections, sandbox.audit_log,
           sandbox.labels, sandbox.batches, sandbox.clients cascade;
  insert into sandbox.audit_log(actor_id, actor_role, action, entity_type, entity_id, result)
    values (auth.uid(), 'admin', 'sandbox.reset', 'sandbox', null, 'ok');
end;
$$;

-- =====================================================================
-- SECTION 8 — GRANTS (execute rights for the RPCs above)
-- Table-level grants are intentionally NOT given beyond what RLS allows;
-- all writes to labels/transactions/corrections/audit_log happen only
-- through these SECURITY DEFINER functions.
-- =====================================================================

grant usage on schema core, sandbox to authenticated;

grant execute on function core.record_delivery to authenticated;
grant execute on function core.create_batch_and_labels to authenticated;
grant execute on function core.admin_set_label_status to authenticated;
grant execute on function core.admin_void_transaction to authenticated;
grant execute on function core.admin_correct_transaction to authenticated;

grant execute on function sandbox.record_delivery to authenticated;
grant execute on function sandbox.create_batch_and_labels to authenticated;
grant execute on function sandbox.admin_set_label_status to authenticated;
grant execute on function sandbox.reset_test_data to authenticated;

-- =====================================================================
-- SECTION 9 — SEED DATA
-- =====================================================================

-- Production: your 15 named products. label_color_hex values are a
-- reasonable starting palette — change freely, it's just data.
insert into core.products (size_mm, color, product_type, label_heading, label_color_hex) values
  (63, 'Golden', 'CH',  '63 MM GOLDEN', '#B8860B'),
  (53, 'Golden', 'CH',  '53 MM GOLDEN', '#B8860B'),
  (63, 'Black',  'CH',  '63 MM BLACK',  '#000000'),
  (53, 'Black',  'CH',  '53 MM BLACK',  '#000000'),
  (63, 'Green',  'CH',  '63 MM GREEN',  '#16A34A'),
  (53, 'Green',  'CH',  '53 MM GREEN',  '#16A34A'),
  (58, 'Golden', 'CH',  '58 MM GOLDEN', '#B8860B'),
  (66, 'Golden', 'CH',  '66 MM GOLDEN', '#B8860B'),
  (63, 'Golden', 'PD',  '63 MM GOLDEN', '#B8860B'),
  (53, 'Golden', 'PD',  '53 MM GOLDEN', '#B8860B'),
  (63, 'Black',  'PD',  '63 MM BLACK',  '#000000'),
  (53, 'Black',  'PD',  '53 MM BLACK',  '#000000'),
  (38, 'Black',  'PD',  '38 MM BLACK',  '#000000'),
  (30, 'Red',    'PD',  '30 MM RED',    '#DC2626'),
  (63, 'Golden', 'IND', '63 MM GOLDEN', '#B8860B');

-- Sandbox: a couple of obviously-fake products/clients for Test Mode,
-- matching your reference sample label.
insert into sandbox.products (size_mm, color, product_type, label_heading, label_color_hex) values
  (30, 'Red', 'PD (test)', '30 MM RED', '#DC2626'),
  (63, 'Golden', 'CH (test)', '63 MM GOLDEN', '#B8860B');

insert into sandbox.clients (name) values ('ABC Test'), ('XYZ Test');

-- =====================================================================
-- END OF MIGRATION — review before applying.
-- =====================================================================
