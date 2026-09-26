-- ==========================================================
-- 0029_maintenances.sql
-- Manutenção do carro: o que já foi feito e quando vence de novo.
--
-- Modificação é melhoria (coilover, downpipe); manutenção é o que o carro
-- cobra sozinho — óleo, correia, pneu. Vinham na mesma lista só porque não
-- havia outra, e aí o custo de troca de óleo entrava como "investido no
-- projeto", inflando o número que a pessoa mostra no perfil.
--
-- O vencimento tem duas contas e vale a que chegar primeiro: por
-- quilometragem (odômetro da troca + intervalo) e por tempo (data da troca +
-- meses). Qualquer uma pode ficar vazia: quem não anota km ainda quer o
-- lembrete anual da correia.
-- ==========================================================

create table if not exists maintenances (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references cars (id) on delete cascade,

  /** Texto livre com sugestões no app: óleo, filtro, correia, pneus... */
  kind text not null,
  done_at date not null,
  /** Quilometragem no dia da troca. */
  odometer integer,
  interval_km integer,
  interval_months integer,
  cost numeric(12, 2),
  notes text,

  /** Quando o lembrete deste item foi enviado — evita repetir todo dia. */
  notified_at timestamptz,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint chk_maintenances_cost check (cost is null or cost >= 0),
  constraint chk_maintenances_odometer check (odometer is null or odometer >= 0),
  constraint chk_maintenances_interval_km check (interval_km is null or interval_km > 0),
  constraint chk_maintenances_interval_months check (interval_months is null or interval_months > 0)
);

create index if not exists idx_maintenances_car_id on maintenances (car_id);
-- O job pergunta pelos itens com prazo que ainda não avisaram.
create index if not exists idx_maintenances_pendentes
  on maintenances (done_at)
  where notified_at is null and (interval_km is not null or interval_months is not null);

drop trigger if exists trg_maintenances_updated_at on maintenances;
create trigger trg_maintenances_updated_at
  before update on maintenances
  for each row
  execute function set_updated_at();

alter table maintenances enable row level security;

-- Diferente de modificação: manutenção é diário de bordo, não vitrine. Só o
-- dono do carro lê. Quem visita a garagem vê os mods, não a nota fiscal do
-- óleo nem a quilometragem real do carro.
drop policy if exists "maintenances_select_own_car" on maintenances;
create policy "maintenances_select_own_car"
  on maintenances for select
  to authenticated
  using (auth.uid() = (select owner_id from cars where id = car_id));

drop policy if exists "maintenances_insert_own_car" on maintenances;
create policy "maintenances_insert_own_car"
  on maintenances for insert
  to authenticated
  with check (auth.uid() = (select owner_id from cars where id = car_id));

drop policy if exists "maintenances_update_own_car" on maintenances;
create policy "maintenances_update_own_car"
  on maintenances for update
  to authenticated
  using (auth.uid() = (select owner_id from cars where id = car_id))
  with check (auth.uid() = (select owner_id from cars where id = car_id));

drop policy if exists "maintenances_delete_own_car" on maintenances;
create policy "maintenances_delete_own_car"
  on maintenances for delete
  to authenticated
  using (auth.uid() = (select owner_id from cars where id = car_id));
