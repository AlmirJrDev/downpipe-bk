-- ==========================================================
-- 0038_ingressos.sql
-- Ingresso e portaria do rolê.
--
-- Até aqui, "confirmados" era só intenção: o organizador sabia quantos
-- disseram que iam, nunca quantos foram. O ingresso fecha essa conta —
-- quem confirma ganha um QR, a portaria lê na entrada, e a presença vira
-- presença de fato.
--
-- Não existe tabela de ingresso: nesta fase não há venda, então o
-- ingresso É a linha de presença com um código. Desmarcar presença apaga a
-- linha e o ingresso some junto; confirmar de novo gera código novo, e o
-- print antigo deixa de valer. Quando entrar ingresso pago (lote, tipo,
-- valor), aí sim ele ganha tabela própria.
-- ==========================================================

create extension if not exists pgcrypto;

alter table event_attendees
  add column if not exists ticket_code text,
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_device text;

-- Quem já tinha confirmado ganha código agora. Hexadecimal porque é o que
-- o Postgres gera sem função extra; os códigos novos saem do backend, num
-- alfabeto sem 0/O e 1/I (ver tickets.service.ts).
update event_attendees
   set ticket_code = upper(encode(gen_random_bytes(5), 'hex'))
 where ticket_code is null;

alter table event_attendees alter column ticket_code set not null;

-- Único no banco inteiro, não só no rolê: a portaria acha o ingresso pelo
-- código, e dois rolês com o mesmo código seria um bug esperando acontecer.
create unique index if not exists event_attendees_ticket_code_key
  on event_attendees (ticket_code);

comment on column event_attendees.ticket_code is
  'Código do ingresso, o que vai no QR. Aleatório: a portaria só aceita os códigos da lista que baixou, então inventar um não leva a nada.';
comment on column event_attendees.checked_in_at is
  'Hora em que a portaria leu o ingresso. Com duas portarias offline liberando o mesmo print, fica a mais cedo.';
comment on column event_attendees.checked_in_device is
  'Qual celular da portaria liberou — pro organizador saber por qual portão a pessoa entrou.';
