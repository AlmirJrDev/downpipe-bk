-- ==========================================================
-- 0036_foto_e_quem_avisou.sql
-- A arte do rolê, e o crédito de quem avisou.
--
-- Duas coisas que faltavam pro rolê trazido de fora parecer um rolê de
-- verdade na tela.
--
-- A primeira é a foto: encontro sem imagem some no meio do calendário, e a
-- arte que o organizador fez já existe no post que serviu de fonte. Guardar
-- o endereço da imagem do Instagram não funcionaria — aquelas URLs expiram
-- em dias —, então o que se guarda aqui é a cópia já no nosso Storage.
--
-- A segunda é de quem é o crédito. Quem aprova na fila não "trouxe" o rolê:
-- na maioria das vezes foi um usuário comum que avisou. Guardar quem avisou
-- separado do organizador é o que deixa a tela creditar a pessoa certa — e
-- ficar calada quando não houve ninguém, em vez de creditar quem aprovou.
-- ==========================================================

alter table event_suggestions
  add column if not exists photo_url text;

alter table events
  add column if not exists tipped_by uuid references profiles (id) on delete set null;

comment on column events.tipped_by is
  'Quem avisou deste rolê pela fila de sugestões. Null quando veio de garimpo nosso — e aí a tela não credita ninguém.';
