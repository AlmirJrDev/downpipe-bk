-- ==========================================================
-- 0041_visitas.sql
-- Quem abriu o site, de onde veio e até onde chegou.
--
-- O log do Render mostrava as visitas do anúncio, mas some em poucos dias
-- e mistura gente com robô. Aqui o servidor anota uma linha por página
-- aberta (a landing e as páginas públicas pelo próprio servidor; as telas
-- do app por um aviso que o app manda a cada troca de tela).
--
-- Nada que identifique alguém: no lugar do IP vai um código embaralhado
-- que muda todo dia. Serve pra contar pessoas diferentes num dia, e não
-- dá pra seguir ninguém de um dia pro outro.
-- ==========================================================

create table if not exists page_views (
  id bigint generated always as identity primary key,
  at timestamptz not null default timezone('utc', now()),
  visitor text not null,
  path text not null,
  source text not null,
  campaign text,
  device text,
  in_app text
);

create index if not exists page_views_at_idx on page_views (at desc);

comment on table page_views is
  'Uma linha por página aberta. Só o backend lê e escreve.';
comment on column page_views.visitor is
  'Código do visitante no dia (HMAC de IP + navegador + data). Muda todo dia; não identifica ninguém.';
comment on column page_views.source is
  'De onde veio: Instagram (anúncio), Instagram, Google, WhatsApp, Direto, Interno…';
comment on column page_views.in_app is
  'instagram/facebook quando a página abriu dentro do navegador da rede social.';

-- Sem policy nenhuma: só o backend (service role) lê e escreve.
alter table page_views enable row level security;
