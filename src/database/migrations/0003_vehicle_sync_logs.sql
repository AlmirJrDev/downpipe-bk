-- ==========================================================
-- 0003_vehicle_sync_logs.sql
-- Registro de execuções do job de sincronização FIPE.
-- ==========================================================

create table if not exists vehicle_sync_logs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  status text not null default 'running',
  records_processed integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  error_message text,

  constraint chk_vehicle_sync_logs_status check (status in ('running', 'success', 'failed'))
);

create index if not exists idx_vehicle_sync_logs_started_at on vehicle_sync_logs (started_at desc);
create index if not exists idx_vehicle_sync_logs_status on vehicle_sync_logs (status);

alter table vehicle_sync_logs enable row level security;

-- Logs de sincronização são informação operacional interna: nenhuma policy
-- de select é criada para usuários comuns (só o service role acessa).
