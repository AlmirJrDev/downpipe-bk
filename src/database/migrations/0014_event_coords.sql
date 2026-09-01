-- ==========================================================
-- 0014_event_coords.sql
-- Coordenadas do evento, para desenhar o local no mapa.
--
-- São preenchidas pelo backend geocodificando "location, city" no
-- momento em que o evento é criado ou tem o endereço alterado — não
-- vêm do app. Ficam nulas quando o endereço não resolve, e nesse caso
-- a tela simplesmente não mostra mapa: evento sem coordenada continua
-- sendo um evento válido.
-- ==========================================================

alter table events add column if not exists latitude double precision;
alter table events add column if not exists longitude double precision;

alter table events drop constraint if exists chk_events_latitude;
alter table events add constraint chk_events_latitude
  check (latitude is null or (latitude >= -90 and latitude <= 90));

alter table events drop constraint if exists chk_events_longitude;
alter table events add constraint chk_events_longitude
  check (longitude is null or (longitude >= -180 and longitude <= 180));
