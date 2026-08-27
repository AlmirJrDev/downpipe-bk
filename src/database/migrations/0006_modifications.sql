-- ==========================================================
-- 0006_modifications.sql
-- Modificações registradas em um carro (independentes de um
-- projeto formal - podem existir mesmo sem projeto ativo).
-- ==========================================================

create table if not exists modifications (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references cars (id) on delete cascade,

  name text not null,
  category text,
  cost numeric(12, 2),
  date date,
  icon text,
  description text,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint chk_modifications_category check (
    category is null or category in
    ('Performance', 'Suspensão', 'Estética', 'Eletrônica', 'Motor', 'Freios', 'Interior', 'Escape', 'Rodas', 'Other')
  ),
  constraint chk_modifications_cost check (cost is null or cost >= 0)
);

create index if not exists idx_modifications_car_id on modifications (car_id);
create index if not exists idx_modifications_category on modifications (category);
create index if not exists idx_modifications_date on modifications (date);

drop trigger if exists trg_modifications_updated_at on modifications;
create trigger trg_modifications_updated_at
  before update on modifications
  for each row
  execute function set_updated_at();

alter table modifications enable row level security;

drop policy if exists "modifications_select_public" on modifications;
create policy "modifications_select_public"
  on modifications for select
  using (true);

drop policy if exists "modifications_insert_own_car" on modifications;
create policy "modifications_insert_own_car"
  on modifications for insert
  to authenticated
  with check (auth.uid() = (select owner_id from cars where id = car_id));

drop policy if exists "modifications_update_own_car" on modifications;
create policy "modifications_update_own_car"
  on modifications for update
  to authenticated
  using (auth.uid() = (select owner_id from cars where id = car_id))
  with check (auth.uid() = (select owner_id from cars where id = car_id));

drop policy if exists "modifications_delete_own_car" on modifications;
create policy "modifications_delete_own_car"
  on modifications for delete
  to authenticated
  using (auth.uid() = (select owner_id from cars where id = car_id));
