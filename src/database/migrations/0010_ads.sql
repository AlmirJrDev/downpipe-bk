-- ==========================================================
-- 0010_ads.sql
-- Estrutura para monetização futura: anunciantes e anúncios.
-- Sem dashboard de anunciante nesta fase (apenas o schema e um
-- endpoint de leitura para o app interlear anúncios no feed).
-- ad_impressions/ad_clicks ficam para uma fase futura, quando
-- métricas de performance de anúncio forem necessárias.
-- ==========================================================

create table if not exists advertisers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_advertisers_updated_at on advertisers;
create trigger trg_advertisers_updated_at
  before update on advertisers
  for each row
  execute function set_updated_at();

-- advertisers não é consultado pelo app: só o service role (backend) lê
-- e escreve nessa tabela, então RLS fica habilitada sem nenhuma policy
-- pública.
alter table advertisers enable row level security;

-- ----------------------------------------------------------

create table if not exists advertisements (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references advertisers (id) on delete cascade,

  title text not null,
  caption text,
  image_url text,
  cta_label text,
  cta_url text,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  budget numeric(12, 2),

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint chk_advertisements_status check (status in ('draft', 'active', 'paused', 'finished')),
  constraint chk_advertisements_budget check (budget is null or budget >= 0),
  constraint chk_advertisements_date_range check (
    starts_at is null or ends_at is null or starts_at <= ends_at
  )
);

create index if not exists idx_advertisements_advertiser_id on advertisements (advertiser_id);
create index if not exists idx_advertisements_status on advertisements (status);
create index if not exists idx_advertisements_active_window on advertisements (status, starts_at, ends_at);

drop trigger if exists trg_advertisements_updated_at on advertisements;
create trigger trg_advertisements_updated_at
  before update on advertisements
  for each row
  execute function set_updated_at();

alter table advertisements enable row level security;

-- O app só precisa enxergar anúncios ativos (para interlear no feed) —
-- rascunhos, pausados e finalizados não ficam públicos.
drop policy if exists "advertisements_select_active" on advertisements;
create policy "advertisements_select_active"
  on advertisements for select
  using (status = 'active');

-- Nenhuma policy de insert/update/delete para "authenticated": a gestão de
-- anúncios acontece apenas via service role (backend/painel futuro), não
-- diretamente pelo app do usuário final.
