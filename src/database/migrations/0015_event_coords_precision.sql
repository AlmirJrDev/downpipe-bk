-- ==========================================================
-- 0015_event_coords_precision.sql
-- Quão confiável é a coordenada do evento.
--
-- Motivo: quando o endereço exato não resolve, a geocodificação cai para
-- o centro da cidade. Testando com endereços reais, "Posto Graal,
-- Marginal Tietê" foi parar na Praça da Sé — uns 8 km fora. Um pino
-- desses parece exato e não é, o que é pior do que não mostrar mapa.
--
-- Guardando a precisão, a tela pode dizer "localização aproximada" em vez
-- de fingir que o ponto é o lugar.
-- ==========================================================

alter table events add column if not exists coords_precision text;

alter table events drop constraint if exists chk_events_coords_precision;
alter table events add constraint chk_events_coords_precision
  check (coords_precision is null or coords_precision in ('exact', 'city'));
