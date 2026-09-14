-- ==========================================================
-- 0023_admins.sql
-- Quem modera o app.
--
-- A fila de denúncias existe desde a 0020, mas ninguém ficava sabendo de
-- uma denúncia nova: ela entrava na tabela e parava lá. Esta tabela diz
-- quem recebe o aviso por push, e quem a ferramenta de moderação trata
-- como moderador.
--
-- Tabela, e não uma coluna em profiles: a policy profiles_update_own deixa
-- a própria pessoa alterar qualquer coluna do seu perfil. Um "is_admin" ali
-- seria uma porta pra qualquer um se promover. Aqui não existe policy
-- nenhuma — só o backend, com a service role, lê e escreve.
-- ==========================================================

create table if not exists admins (
  user_id uuid primary key references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;
