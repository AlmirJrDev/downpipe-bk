-- ==========================================================
-- 0040_relatos.sql
-- O relato de quem usa: "como tá sendo usar o Downpipe".
--
-- Com pouca gente usando, cada conversa vale mais que qualquer gráfico. A
-- pessoa dá uma nota, escreve o que quiser e diz se topa ser chamada pra
-- conversar. Quem modera lê numa tela própria e marca como lido.
--
-- Vai embora junto com a conta (cascade): quem pede pra excluir tudo não
-- deixa texto seu pra trás.
-- ==========================================================

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  message text not null check (char_length(message) between 1 and 4000),
  can_contact boolean not null default false,
  device text,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists feedback_created_at_idx on feedback (created_at desc);

comment on table feedback is
  'Relatos de experiência mandados pelo app. Só o backend lê e escreve.';
comment on column feedback.can_contact is
  'A pessoa topou ser chamada pra conversar sobre o relato.';
comment on column feedback.device is
  'Celular ou computador, e o navegador — pra separar problema de tela de problema de ideia.';

-- Sem policy nenhuma: só o backend (service role) lê e escreve.
alter table feedback enable row level security;
