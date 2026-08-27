-- ==========================================================
-- 0002_vehicle_catalog.sql
-- Base própria de veículos (marcas / modelos / versões),
-- alimentada pelo serviço de sincronização FIPE (não consultada
-- diretamente pela FIPE a cada requisição do usuário).
-- ==========================================================

create table if not exists vehicle_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fipe_code text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_vehicle_brands_name on vehicle_brands (name);
create index if not exists idx_vehicle_brands_fipe_code on vehicle_brands (fipe_code);

drop trigger if exists trg_vehicle_brands_updated_at on vehicle_brands;
create trigger trg_vehicle_brands_updated_at
  before update on vehicle_brands
  for each row
  execute function set_updated_at();

-- ----------------------------------------------------------

create table if not exists vehicle_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references vehicle_brands (id) on delete cascade,
  name text not null,
  fipe_code text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  -- o código de modelo da FIPE é único apenas dentro de uma marca
  constraint uq_vehicle_models_brand_fipe unique (brand_id, fipe_code)
);

create index if not exists idx_vehicle_models_brand_id on vehicle_models (brand_id);
create index if not exists idx_vehicle_models_name on vehicle_models (name);
create index if not exists idx_vehicle_models_fipe_code on vehicle_models (fipe_code);

drop trigger if exists trg_vehicle_models_updated_at on vehicle_models;
create trigger trg_vehicle_models_updated_at
  before update on vehicle_models
  for each row
  execute function set_updated_at();

-- ----------------------------------------------------------

create table if not exists vehicle_versions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references vehicle_models (id) on delete cascade,
  name text not null,
  year integer not null,
  fuel text,
  fipe_code text not null,
  fipe_price numeric(12, 2),
  fipe_reference_month text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  -- código "ano" da FIPE (ex.: "2014-3") é único dentro de um modelo
  constraint uq_vehicle_versions_model_fipe unique (model_id, fipe_code),
  constraint chk_vehicle_versions_year check (year between 1900 and 2100)
);

create index if not exists idx_vehicle_versions_model_id on vehicle_versions (model_id);
create index if not exists idx_vehicle_versions_year on vehicle_versions (year);
create index if not exists idx_vehicle_versions_fipe_code on vehicle_versions (fipe_code);
create index if not exists idx_vehicle_versions_name on vehicle_versions (name);

drop trigger if exists trg_vehicle_versions_updated_at on vehicle_versions;
create trigger trg_vehicle_versions_updated_at
  before update on vehicle_versions
  for each row
  execute function set_updated_at();

-- ----------------------------------------------------------
-- Row Level Security: catálogo é público para leitura; escrita
-- só acontece via service role (job de sincronização FIPE).
-- ----------------------------------------------------------
alter table vehicle_brands enable row level security;
alter table vehicle_models enable row level security;
alter table vehicle_versions enable row level security;

drop policy if exists "vehicle_brands_select_public" on vehicle_brands;
create policy "vehicle_brands_select_public"
  on vehicle_brands for select
  using (true);

drop policy if exists "vehicle_models_select_public" on vehicle_models;
create policy "vehicle_models_select_public"
  on vehicle_models for select
  using (true);

drop policy if exists "vehicle_versions_select_public" on vehicle_versions;
create policy "vehicle_versions_select_public"
  on vehicle_versions for select
  using (true);

-- Nenhuma policy de insert/update/delete é criada para usuários comuns:
-- apenas o service role (que ignora RLS) pode escrever nessas tabelas,
-- e isso só acontece através do serviço de sincronização FIPE.
