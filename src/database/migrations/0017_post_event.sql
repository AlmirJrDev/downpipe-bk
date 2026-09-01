-- ==========================================================
-- 0017_post_event.sql
-- Marcar a publicação com o rolê onde a foto foi tirada.
--
-- É isso que transforma o evento numa memória coletiva: depois do
-- encontro, a página dele reúne o que cada um registrou lá.
--
-- on delete SET NULL, e não cascade: se o organizador apagar o evento,
-- as fotos das pessoas não podem sumir junto — o registro é delas, a
-- marcação é que deixa de existir.
-- ==========================================================

alter table posts add column if not exists event_id uuid references events (id) on delete set null;

-- Consulta principal: as publicações de um evento, da mais recente pra
-- mais antiga.
create index if not exists idx_posts_event_created on posts (event_id, created_at desc)
  where event_id is not null;
