-- ==========================================================
-- 0035_role_de_fora.sql
-- Rolê trazido de fora: quem organiza de verdade, e como avisar que ele não
-- existe.
--
-- Rolê que veio de um post de Instagram tem um problema de autoria: quem
-- aprova na fila entra como organizador dentro do app, porque alguém precisa
-- responder por ele — mas quem organiza mesmo é o perfil que divulgou. Sem
-- dizer isso na tela, o app se apresenta como dono de um encontro que não é
-- dele, e a pessoa que quer perguntar "vai ter mesmo?" pergunta pra quem não
-- sabe responder.
--
-- E o risco do outro lado: informação de segunda mão envelhece. Encontro
-- cancelado, data que mudou no story e não no post, cartaz do ano passado
-- reaproveitado. Quem dirigiu 60 km e achou o posto vazio precisa de um
-- botão — senão o aviso não chega, e o próximo também viaja à toa.
-- ==========================================================

-- ---------- quem organiza de verdade ----------
-- Só o @: o link se monta a partir dele, e guardar URL inteira convidaria a
-- guardar link de post, de story, de qualquer coisa — e aí não dá mais pra
-- dizer "fale com essa pessoa".
alter table events
  add column if not exists organizer_instagram text;

alter table event_suggestions
  add column if not exists organizer_instagram text;

-- O que já está na fila veio com a fonte escrita à mão ("Post do @fulano").
-- O @ estava ali o tempo todo, só não em coluna própria.
update event_suggestions
   set organizer_instagram = lower(substring(source_note from '@([A-Za-z0-9_.]+)'))
 where organizer_instagram is null
   and source_note ~ '@[A-Za-z0-9_.]+';

-- ---------- denunciar um rolê ----------
alter table reports
  add column if not exists event_id uuid references events (id) on delete cascade;

-- A regra de "exatamente um alvo" cresce junto: sem recriar, o banco aceitaria
-- uma denúncia sem alvo nenhum, com só o event_id preenchido.
alter table reports drop constraint if exists reports_um_alvo;
alter table reports add constraint reports_um_alvo check (
  (post_id is not null)::int
  + (comment_id is not null)::int
  + (profile_id is not null)::int
  + (message_id is not null)::int
  + (event_id is not null)::int = 1
);

-- Uma denúncia por pessoa por rolê, como nos outros alvos.
create unique index if not exists idx_reports_unico_event
  on reports (reporter_id, event_id) where event_id is not null;
