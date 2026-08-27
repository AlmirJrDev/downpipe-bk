-- ==========================================================
-- 0004_cars.sql
-- Carros pertencentes aos usuários (separados do catálogo de
-- veículos) + configuração dos buckets de Storage usados pelo
-- app (avatars / cars / posts).
-- ==========================================================

create table if not exists cars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  vehicle_version_id uuid references vehicle_versions (id) on delete set null,

  version text,
  engine text,
  power integer,
  torque integer,
  transmission text,
  drivetrain text,
  mileage integer,
  description text,
  photo_url text,

  status text not null default 'planning',
  -- project_progress e amount_invested são campos derivados: a partir da
  -- Fase 4 (projects/modifications) passam a ser recalculados pelo backend
  -- com base nas etapas do projeto e nas modificações do carro. Eles NUNCA
  -- devem ser aceitos diretamente do frontend em create/update.
  project_progress integer not null default 0,
  amount_invested numeric(12, 2) not null default 0,
  category text,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint chk_cars_status check (status in ('planning', 'building', 'complete')),
  constraint chk_cars_category check (
    category is null or category in
    ('JDM', 'Euro', 'Muscle', 'Performance', 'Clássicos', 'Stance', 'Other')
  ),
  constraint chk_cars_project_progress check (project_progress between 0 and 100),
  constraint chk_cars_amount_invested check (amount_invested >= 0),
  constraint chk_cars_mileage check (mileage is null or mileage >= 0)
);

create index if not exists idx_cars_owner_id on cars (owner_id);
create index if not exists idx_cars_vehicle_version_id on cars (vehicle_version_id);
create index if not exists idx_cars_created_at on cars (created_at desc);
create index if not exists idx_cars_category on cars (category);
create index if not exists idx_cars_status on cars (status);

drop trigger if exists trg_cars_updated_at on cars;
create trigger trg_cars_updated_at
  before update on cars
  for each row
  execute function set_updated_at();

-- ----------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------
alter table cars enable row level security;

-- Carros são públicos para leitura (qualquer usuário pode ver o carro de
-- qualquer outro usuário).
drop policy if exists "cars_select_public" on cars;
create policy "cars_select_public"
  on cars for select
  using (true);

drop policy if exists "cars_insert_own" on cars;
create policy "cars_insert_own"
  on cars for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "cars_update_own" on cars;
create policy "cars_update_own"
  on cars for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "cars_delete_own" on cars;
create policy "cars_delete_own"
  on cars for delete
  to authenticated
  using (auth.uid() = owner_id);

-- ==========================================================
-- Storage: buckets avatars / cars / posts
-- ==========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('cars', 'cars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('posts', 'posts', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Convenção de path: {bucket}/{userId}/{arquivo}. As policies abaixo
-- garantem que um usuário só pode escrever dentro da sua própria "pasta"
-- (primeiro segmento do path = seu auth.uid()), enquanto a leitura é
-- pública (buckets marcados como public acima).

drop policy if exists "storage_public_read" on storage.objects;
create policy "storage_public_read"
  on storage.objects for select
  using (bucket_id in ('avatars', 'cars', 'posts'));

drop policy if exists "storage_insert_own_folder" on storage.objects;
create policy "storage_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('avatars', 'cars', 'posts')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "storage_update_own_folder" on storage.objects;
create policy "storage_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('avatars', 'cars', 'posts')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "storage_delete_own_folder" on storage.objects;
create policy "storage_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('avatars', 'cars', 'posts')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
