-- ==========================================================
-- 0039_ingresso_codigo_padrao.sql
-- Código de ingresso gerado pelo banco quando o insert não manda um.
--
-- A 0038 deixou ticket_code obrigatório, e o backend que estava no ar
-- ainda não mandava o código ao confirmar presença: entre a migration e o
-- deploy, todo "eu vou" falhava. Com o padrão, qualquer insert ganha
-- código — o do backend novo (alfabeto sem 0/O e 1/I) ou, na falta dele,
-- o hexadecimal do banco. É também a rede de segurança pra qualquer outro
-- caminho que crie presença sem passar por createAttendance.
-- ==========================================================

alter table event_attendees
  alter column ticket_code set default upper(encode(gen_random_bytes(5), 'hex'));
