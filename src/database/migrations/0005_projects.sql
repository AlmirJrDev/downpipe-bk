-- ==========================================================
-- 0005_projects.sql
-- Um carro pode possuir um projeto (1:1), e um projeto possui
-- várias etapas (project_steps).
-- ==========================================================

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null unique references cars (id) on delete cascade,
  title text not null,
  power_goal_from integer,
  power_goal_to integer,
  budget_total numeric(12, 2),

  -- Campos derivados: recalculados pelo backend (car-aggregates.service)
  -- sempre que uma etapa (project_step) é criada/atualizada/removida.
  -- NUNCA aceitos diretamente do frontend em create/update.
  budget_spent numeric(12, 2) not null default 0,
  modifications_total integer not null default 0,
  modifications_done integer not null default 0,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint chk_projects_power_goal check (
    power_goal_from is null or power_goal_to is null or power_goal_from <= power_goal_to
  ),
  constraint chk_projects_budget_total check (budget_total is null or budget_total >= 0),
  constraint chk_projects_budget_spent check (budget_spent >= 0),
  constraint chk_projects_modifications_done check (modifications_done <= modifications_total)
);

create index if not exists idx_projects_car_id on projects (car_id);

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at
  before update on projects
  for each row
  execute function set_updated_at();

alter table projects enable row level security;

drop policy if exists "projects_select_public" on projects;
create policy "projects_select_public"
  on projects for select
  using (true);

drop policy if exists "projects_insert_own_car" on projects;
create policy "projects_insert_own_car"
  on projects for insert
  to authenticated
  with check (auth.uid() = (select owner_id from cars where id = car_id));

drop policy if exists "projects_update_own_car" on projects;
create policy "projects_update_own_car"
  on projects for update
  to authenticated
  using (auth.uid() = (select owner_id from cars where id = car_id))
  with check (auth.uid() = (select owner_id from cars where id = car_id));

drop policy if exists "projects_delete_own_car" on projects;
create policy "projects_delete_own_car"
  on projects for delete
  to authenticated
  using (auth.uid() = (select owner_id from cars where id = car_id));

-- ----------------------------------------------------------

create table if not exists project_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  car_id uuid not null references cars (id) on delete cascade,
  name text not null,
  status text not null default 'pending',
  estimated_cost numeric(12, 2),
  actual_cost numeric(12, 2),
  date date,
  description text,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint chk_project_steps_status check (status in ('pending', 'active', 'done')),
  constraint chk_project_steps_estimated_cost check (estimated_cost is null or estimated_cost >= 0),
  constraint chk_project_steps_actual_cost check (actual_cost is null or actual_cost >= 0)
);

create index if not exists idx_project_steps_project_id on project_steps (project_id);
create index if not exists idx_project_steps_car_id on project_steps (car_id);
create index if not exists idx_project_steps_position on project_steps (project_id, position);

drop trigger if exists trg_project_steps_updated_at on project_steps;
create trigger trg_project_steps_updated_at
  before update on project_steps
  for each row
  execute function set_updated_at();

alter table project_steps enable row level security;

drop policy if exists "project_steps_select_public" on project_steps;
create policy "project_steps_select_public"
  on project_steps for select
  using (true);

drop policy if exists "project_steps_insert_own_car" on project_steps;
create policy "project_steps_insert_own_car"
  on project_steps for insert
  to authenticated
  with check (auth.uid() = (select owner_id from cars where id = car_id));

drop policy if exists "project_steps_update_own_car" on project_steps;
create policy "project_steps_update_own_car"
  on project_steps for update
  to authenticated
  using (auth.uid() = (select owner_id from cars where id = car_id))
  with check (auth.uid() = (select owner_id from cars where id = car_id));

drop policy if exists "project_steps_delete_own_car" on project_steps;
create policy "project_steps_delete_own_car"
  on project_steps for delete
  to authenticated
  using (auth.uid() = (select owner_id from cars where id = car_id));
