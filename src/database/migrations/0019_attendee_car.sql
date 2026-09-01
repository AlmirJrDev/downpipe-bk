-- ==========================================================
-- 0019_attendee_car.sql
-- Qual carro a pessoa vai levar no rolê.
--
-- Responde a pergunta que ninguém consegue fazer sem constranger:
-- "de quem é esse carro?". Vendo o carro no encontro, dá pra achar na
-- lista de confirmados e descobrir o dono.
--
-- NULO de propósito, e é o padrão: muita gente vai de carona, vai a pé,
-- ou vai justamente pra fotografar o carro dos outros. Confirmar presença
-- continua sendo um toque só; escolher o carro é um passo opcional depois.
--
-- on delete SET NULL: apagar o carro da garagem não pode desfazer a
-- presença da pessoa no rolê.
-- ==========================================================

alter table event_attendees
  add column if not exists car_id uuid references cars (id) on delete set null;

create index if not exists idx_event_attendees_car on event_attendees (car_id)
  where car_id is not null;
