-- ==========================================================
-- 0043_links_de_encontro.sql
-- Caixa de links: o post de encontro que alguém da equipe achou.
--
-- Achar encontro é rolar o Instagram; preencher nome, data e endereço no
-- celular, na hora, é o que fazia a gente deixar pra depois e esquecer. Aqui
-- só se cola o link (e uma nota, se quiser). Depois alguém lê o post e lança
-- como sugestão completa na fila — e o link fica marcado como lançado, com a
-- sugestão que virou.
-- ==========================================================

create table if not exists event_links (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  note text,
  status text not null default 'novo',
  suggestion_id uuid references event_suggestions (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  handled_at timestamptz,

  constraint chk_event_links_status check (status in ('novo', 'lancado', 'descartado')),
  constraint chk_event_links_url check (url ~* '^https?://')
);

-- O mesmo post colado duas vezes vira uma linha só.
create unique index if not exists event_links_url_key on event_links (url);
create index if not exists event_links_status_idx on event_links (status, created_at);

comment on table event_links is
  'Links de post de encontro guardados pela equipe pra lançar depois na fila de sugestões.';

-- Sem policy nenhuma: só o backend (service role) lê e escreve.
alter table event_links enable row level security;
