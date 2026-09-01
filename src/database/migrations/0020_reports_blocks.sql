-- ==========================================================
-- 0020_reports_blocks.sql
-- Denunciar conteúdo e bloquear pessoas.
--
-- Um app onde qualquer um publica foto e marca o carro dos outros precisa
-- dos dois: denunciar é o que dá saída pra quem viu algo errado, e bloquear
-- é o que dá saída pra quem está sendo importunado. Sem eles a única opção
-- da pessoa é sair do app.
-- ==========================================================

-- ---------- denúncias ----------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles (id) on delete cascade,

  -- Um dos três é preenchido; os outros ficam nulos. Sem tabela separada
  -- por tipo: são poucos campos e a moderação quer olhar uma fila só.
  post_id uuid references posts (id) on delete cascade,
  comment_id uuid references comments (id) on delete cascade,
  profile_id uuid references profiles (id) on delete cascade,

  reason text not null,
  details text,

  -- 'open' entra na fila; 'reviewed' saiu dela. Quem revisa é gente, por
  -- enquanto direto no banco — não há painel ainda, e inventar um agora
  -- seria construir antes de saber o volume.
  status text not null default 'open' check (status in ('open', 'reviewed')),

  created_at timestamptz not null default now(),

  -- Exatamente um alvo por denúncia.
  constraint reports_um_alvo check (
    (post_id is not null)::int + (comment_id is not null)::int + (profile_id is not null)::int = 1
  )
);

-- A fila de moderação lê por status e data.
create index if not exists idx_reports_status_created on reports (status, created_at desc);

-- Uma denúncia por pessoa por alvo: denunciar duas vezes não aumenta a
-- gravidade, só infla a fila.
create unique index if not exists idx_reports_unico_post
  on reports (reporter_id, post_id) where post_id is not null;
create unique index if not exists idx_reports_unico_comment
  on reports (reporter_id, comment_id) where comment_id is not null;
create unique index if not exists idx_reports_unico_profile
  on reports (reporter_id, profile_id) where profile_id is not null;

alter table reports enable row level security;

-- Ninguém lê denúncia pelo cliente: a fila é do time, e expor quem
-- denunciou quem seria pior do que não ter denúncia. Toda a leitura passa
-- pelo backend com a service role.
create policy "reports_insert_proprio" on reports
  for insert with check (auth.uid() = reporter_id);

-- ---------- bloqueios ----------
create table if not exists blocks (
  blocker_id uuid not null references profiles (id) on delete cascade,
  blocked_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  -- Bloquear a si mesmo não significa nada.
  constraint blocks_nao_a_si check (blocker_id <> blocked_id)
);

-- O feed filtra por "quem eu bloqueei" e por "quem me bloqueou", então as
-- duas direções precisam de índice.
create index if not exists idx_blocks_blocker on blocks (blocker_id);
create index if not exists idx_blocks_blocked on blocks (blocked_id);

alter table blocks enable row level security;

create policy "blocks_select_proprio" on blocks
  for select using (auth.uid() = blocker_id);
create policy "blocks_insert_proprio" on blocks
  for insert with check (auth.uid() = blocker_id);
create policy "blocks_delete_proprio" on blocks
  for delete using (auth.uid() = blocker_id);
