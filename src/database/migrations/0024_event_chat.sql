-- ==========================================================
-- 0024_event_chat.sql
-- Chat do rolê: conversa entre quem confirmou presença e o organizador.
--
-- Antes, mudar horário ou local não avisava ninguém, e quem ia ao rolê só
-- descobria se abrisse a tela de novo. O chat resolve as duas pontas: as
-- pessoas conversam entre si ("vou atrasar", "quem leva cabo?"), e o próprio
-- sistema escreve ali quando o organizador muda horário ou local.
-- ==========================================================

create table if not exists event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,

  -- Nulo nas mensagens do sistema ("horário mudou para..."), que não têm
  -- autor. Conta apagada leva as próprias mensagens junto.
  author_id uuid references profiles (id) on delete cascade,

  kind text not null default 'mensagem' check (kind in ('mensagem', 'sistema')),
  text text not null check (char_length(text) between 1 and 1000),

  created_at timestamptz not null default timezone('utc', now()),

  -- Mensagem de gente precisa de autor; a do sistema, não pode ter.
  constraint event_messages_autor_coerente check (
    (kind = 'mensagem' and author_id is not null) or (kind = 'sistema' and author_id is null)
  )
);

-- O chat sempre lê "as mais recentes de um rolê".
create index if not exists idx_event_messages_event_created
  on event_messages (event_id, created_at desc);

-- Sem policy nenhuma: quem pode ler é quem confirmou presença, e essa regra
-- mora no backend, que usa a service role. O app nunca fala direto com a
-- tabela.
alter table event_messages enable row level security;

-- ----------------------------------------------------------
-- Até onde cada pessoa leu, e quando recebeu o último push.
--
-- É o que impede o chat de virar cinquenta notificações por hora: a pessoa
-- recebe um push na primeira mensagem nova depois da última vez que abriu
-- o chat, e nada mais até abrir de novo.
-- ----------------------------------------------------------

create table if not exists event_chat_reads (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  last_read_at timestamptz not null default timezone('utc', now()),
  last_pushed_at timestamptz,
  primary key (event_id, user_id)
);

alter table event_chat_reads enable row level security;

-- ----------------------------------------------------------
-- Denunciar mensagem do chat, na mesma fila das outras denúncias.
-- ----------------------------------------------------------

alter table reports
  add column if not exists message_id uuid references event_messages (id) on delete cascade;

alter table reports drop constraint if exists reports_um_alvo;
alter table reports add constraint reports_um_alvo check (
  (post_id is not null)::int
    + (comment_id is not null)::int
    + (profile_id is not null)::int
    + (message_id is not null)::int = 1
);

create unique index if not exists idx_reports_unico_message
  on reports (reporter_id, message_id) where message_id is not null;
