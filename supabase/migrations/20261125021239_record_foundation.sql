-- record_foundation
-- The donation record for Operation Kokua: raw-first import tables, the
-- structured record derived from them, and two read views.
-- Every structured row belongs to an import batch, and a batch is either
-- synthetic or real. Row level security is on for every table with no policy,
-- so only the server (service role) reads or writes.
--
-- Verification (must print pass):
--   select case when
--     (select count(*) from pg_tables where schemaname = 'public' and rowsecurity
--        and tablename in ('app_admins','import_batches','import_rows','documents','document_links',
--          'sources','recipients','trips','items','valuations','shipments','handovers','followups')) = 13
--     and (select count(*) from pg_policies where schemaname = 'public') = 0
--     and (select count(*) from pg_views where schemaname = 'public'
--        and viewname in ('handover_facts','totals_by_basis')) = 2
--     and exists (select 1 from pg_type where typname = 'record_kind')
--   then 'pass' else 'FAIL' end as record_foundation;

create type public.record_kind as enum ('synthetic', 'real');

create table public.app_admins (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now(),
  note text
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  kind public.record_kind not null,
  label text not null,
  source_filename text,
  source_sha256 text,
  received_from text,
  received_on date,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches (id) on delete cascade,
  sheet text not null,
  row_number integer not null check (row_number > 0),
  raw jsonb not null,
  created_at timestamptz not null default now(),
  unique (batch_id, sheet, row_number)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches (id) on delete cascade,
  kind text not null check (kind in ('packing-list', 'letter', 'customs', 'receipt', 'photo', 'spreadsheet', 'other')),
  title text not null,
  storage_path text,
  sha256 text,
  note text,
  created_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches (id) on delete cascade,
  import_row_id uuid references public.import_rows (id) on delete set null,
  name text not null,
  kind text not null default 'unknown' check (kind in ('hospital', 'manufacturer', 'individual', 'other', 'unknown')),
  city text,
  country text,
  note text,
  created_at timestamptz not null default now()
);

create table public.recipients (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches (id) on delete cascade,
  import_row_id uuid references public.import_rows (id) on delete set null,
  name text not null,
  department text,
  city text,
  country text not null,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  contact_name text,
  note text,
  created_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches (id) on delete cascade,
  import_row_id uuid references public.import_rows (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  year integer not null check (year between 1990 and 2100),
  month integer check (month between 1 and 12),
  city text,
  country text not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches (id) on delete cascade,
  import_row_id uuid references public.import_rows (id) on delete set null,
  source_id uuid references public.sources (id) on delete set null,
  category text,
  description text not null,
  manufacturer text,
  model text,
  serial_number text,
  quantity integer not null default 1 check (quantity > 0),
  condition text not null default 'unknown' check (condition in ('new', 'used-working', 'used-needs-service', 'unknown')),
  year_made integer check (year_made between 1950 and 2100),
  note text,
  created_at timestamptz not null default now()
);

create table public.valuations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  import_row_id uuid references public.import_rows (id) on delete set null,
  basis text not null check (basis in ('original-cost', 'fair-market', 'replacement', 'recipient-stated')),
  amount_usd numeric(14, 2) not null check (amount_usd >= 0),
  per text not null default 'lot' check (per in ('unit', 'lot')),
  method_note text,
  valued_on date,
  valued_by text,
  created_at timestamptz not null default now(),
  unique (item_id, basis)
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches (id) on delete cascade,
  import_row_id uuid references public.import_rows (id) on delete set null,
  trip_id uuid references public.trips (id) on delete set null,
  reference text,
  shipped_on date,
  arrived_on date,
  mode text not null default 'unknown' check (mode in ('hand-carried', 'air-freight', 'sea-freight', 'courier', 'unknown')),
  origin text,
  carrier text,
  weight_kg numeric(10, 2) check (weight_kg >= 0),
  cost_usd numeric(12, 2) check (cost_usd >= 0),
  paid_by text,
  paperwork_note text,
  created_at timestamptz not null default now()
);

create table public.handovers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches (id) on delete cascade,
  import_row_id uuid references public.import_rows (id) on delete set null,
  item_id uuid not null references public.items (id) on delete cascade,
  recipient_id uuid not null references public.recipients (id) on delete restrict,
  shipment_id uuid references public.shipments (id) on delete set null,
  trip_id uuid references public.trips (id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  handed_on date,
  date_precision text not null default 'unknown' check (date_precision in ('day', 'month', 'year', 'unknown')),
  delivered_by text,
  received_by text,
  acknowledgment_note text,
  created_at timestamptz not null default now()
);

create table public.followups (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.handovers (id) on delete cascade,
  import_row_id uuid references public.import_rows (id) on delete set null,
  checked_on date not null,
  in_service boolean,
  checked_by text,
  note text,
  created_at timestamptz not null default now()
);

create table public.document_links (
  document_id uuid not null references public.documents (id) on delete cascade,
  table_name text not null check (table_name in ('sources', 'recipients', 'trips', 'items', 'valuations', 'shipments', 'handovers', 'followups')),
  row_id uuid not null,
  primary key (document_id, table_name, row_id)
);

create index import_rows_batch_idx on public.import_rows (batch_id);
create index items_batch_idx on public.items (batch_id);
create index items_source_idx on public.items (source_id);
create index valuations_item_idx on public.valuations (item_id);
create index handovers_item_idx on public.handovers (item_id);
create index handovers_recipient_idx on public.handovers (recipient_id);
create index handovers_trip_idx on public.handovers (trip_id);
create index handovers_shipment_idx on public.handovers (shipment_id);
create index followups_handover_idx on public.followups (handover_id);
create index shipments_trip_idx on public.shipments (trip_id);
create index document_links_row_idx on public.document_links (table_name, row_id);

alter table public.app_admins enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;
alter table public.documents enable row level security;
alter table public.document_links enable row level security;
alter table public.sources enable row level security;
alter table public.recipients enable row level security;
alter table public.trips enable row level security;
alter table public.items enable row level security;
alter table public.valuations enable row level security;
alter table public.shipments enable row level security;
alter table public.handovers enable row level security;
alter table public.followups enable row level security;

-- One row per handover with its item, recipient, trip and batch kind.
-- A handover of part of a lot carries that share of a per-lot valuation.
create view public.handover_facts with (security_invoker = true) as
select
  h.id as handover_id,
  b.kind,
  h.handed_on,
  h.date_precision,
  h.quantity as handed_quantity,
  i.id as item_id,
  i.category,
  i.description,
  i.manufacturer,
  i.model,
  i.serial_number,
  i.quantity as item_quantity,
  i.condition,
  r.id as recipient_id,
  r.name as recipient_name,
  r.city as recipient_city,
  r.country as recipient_country,
  t.slug as trip_slug,
  h.shipment_id
from public.handovers h
join public.import_batches b on b.id = h.batch_id
join public.items i on i.id = h.item_id
join public.recipients r on r.id = h.recipient_id
left join public.trips t on t.id = h.trip_id;

-- Totals never mix valuation bases or batch kinds.
create view public.totals_by_basis with (security_invoker = true) as
select
  b.kind,
  v.basis,
  count(distinct h.id) as handovers,
  sum(h.quantity) as units,
  sum(
    case v.per
      when 'unit' then v.amount_usd * h.quantity
      else v.amount_usd * h.quantity / i.quantity
    end
  )::numeric(16, 2) as amount_usd
from public.handovers h
join public.import_batches b on b.id = h.batch_id
join public.items i on i.id = h.item_id
join public.valuations v on v.item_id = i.id
group by b.kind, v.basis;

revoke all on all tables in schema public from anon, authenticated;
