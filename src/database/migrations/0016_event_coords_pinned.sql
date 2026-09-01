-- ==========================================================
-- 0016_event_coords_pinned.sql
-- Terceiro nível de precisão: 'pinned'.
--
-- 'exact' e 'city' vêm de geocodificação — ou seja, de um palpite do
-- servidor sobre um texto livre, que pode acertar ou errar feio.
-- 'pinned' é a coordenada que o próprio organizador escolheu, arrastando
-- o pino ou usando o GPS. É a única em que se pode confiar sem ressalva.
-- ==========================================================

alter table events drop constraint if exists chk_events_coords_precision;
alter table events add constraint chk_events_coords_precision
  check (coords_precision is null or coords_precision in ('exact', 'city', 'pinned'));
