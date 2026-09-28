-- ==========================================================
-- 0034_event_suggestions.sql
-- Rolês que alguém viu por aí e ainda não são rolês.
--
-- A cena publica encontro em story, grupo de WhatsApp, calendário de clube e
-- notícia de portal. Nada disso entra sozinho no app — e nem deveria: data
-- errada, evento cancelado ou encontro que nunca existiu queimam a confiança
-- muito mais rápido do que uma agenda vazia.
--
-- Então tudo que vem de fora cai aqui primeiro, com a fonte anotada, e só
-- vira rolê de verdade quando alguém da casa aprova. As colunas espelham as
-- de `events` porque a aprovação é uma cópia — sem conversão, sem campo que
-- se perde no caminho.
-- ==========================================================

create table if not exists event_suggestions (
  id uuid primary key default gen_random_uuid(),

  -- O rolê em si. Só o nome é obrigatório: sugestão é rascunho, e exigir
  -- endereço completo de quem só viu um story faria ninguém sugerir nada.
  name text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  ends_at_estimated boolean not null default false,
  location text,
  city text,
  address text,
  latitude double precision,
  longitude double precision,
  entry_note text,
  attractions text[] not null default '{}',
  rules text[] not null default '{}',
  kind text,
  car_categories text[] not null default '{}',

  -- De onde veio. `source_url` é o que permite conferir antes de aprovar, e
  -- vira crédito quando o rolê é publicado.
  source text not null default 'manual',
  source_url text,
  source_note text,
  suggested_by uuid references profiles (id) on delete set null,

  -- A fila.
  status text not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid references profiles (id) on delete set null,
  /** O rolê criado a partir desta sugestão, quando aprovada. */
  event_id uuid references events (id) on delete set null,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint chk_event_suggestions_status check (status in ('pending', 'approved', 'rejected')),
  constraint chk_event_suggestions_source check (source in ('web', 'usuario', 'manual'))
);

create index if not exists idx_event_suggestions_pendentes
  on event_suggestions (created_at)
  where status = 'pending';

-- O mesmo encontro achado duas vezes (dois portais, dois usuários) não pode
-- virar duas linhas na fila. Nome + horário é o par que identifica na prática.
create unique index if not exists uq_event_suggestions_nome_horario
  on event_suggestions (lower(name), starts_at);

drop trigger if exists trg_event_suggestions_updated_at on event_suggestions;
create trigger trg_event_suggestions_updated_at
  before update on event_suggestions
  for each row
  execute function set_updated_at();

-- Sem policy nenhuma: só o backend (service role) lê e escreve. Quem sugere
-- fala com a API; a fila em si não é assunto público.
alter table event_suggestions enable row level security;

-- ----------------------------------------------------------
-- O crédito no rolê publicado.
--
-- Publicar encontro dos outros sem dizer de onde veio é se apropriar do
-- trabalho de quem organiza — e esconde do usuário que a informação é de
-- segunda mão, que é exatamente o que ele precisa saber pra conferir antes
-- de viajar até lá.
-- ----------------------------------------------------------
alter table events
  add column if not exists source_url text,
  add column if not exists source_note text;
