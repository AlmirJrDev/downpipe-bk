-- ==========================================================
-- 0026_event_messages_deleted_at.sql
-- Mensagem apagada vira marcação, e não some da tabela.
--
-- O chat aberto confere a cada poucos segundos só o que chegou de novo.
-- Com a linha apagada de verdade, quem estava com a conversa aberta nunca
-- ficava sabendo: a mensagem continuava na tela dele até sair e entrar de
-- novo. Com a marcação, a conferida pergunta também "o que foi apagado desde
-- a última vez" e a tela tira a mensagem na hora.
--
-- De quebra, a denúncia de uma mensagem apagada continua na fila com o
-- texto, em vez de sumir junto por cascata — quem modera ainda vê o que foi
-- dito.
-- ==========================================================

alter table event_messages add column if not exists deleted_at timestamptz;

-- A conferida procura "apagadas deste rolê depois de tal hora".
create index if not exists idx_event_messages_event_deleted
  on event_messages (event_id, deleted_at)
  where deleted_at is not null;
