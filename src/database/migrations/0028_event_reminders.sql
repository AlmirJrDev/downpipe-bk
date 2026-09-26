-- ==========================================================
-- 0028_event_reminders.sql
-- Lembrete do rolê que está chegando.
--
-- O push do app só saía quando ACONTECIA alguma coisa: mensagem no chat,
-- mudança de horário, cancelamento. Quem confirmou presença e não voltou
-- mais na tela simplesmente esquecia — e rolê vazio mata o encontro
-- seguinte. A coluna guarda quando o lembrete daquele rolê já foi mandado,
-- pra ele sair uma vez só por mais que o job rode a cada 15 minutos.
-- ==========================================================

alter table events add column if not exists reminder_sent_at timestamptz;

-- O job pergunta sempre a mesma coisa: quais rolês começam logo e ainda não
-- foram avisados. Índice parcial, porque rolê já avisado não interessa mais.
create index if not exists events_lembrete_pendente_idx
  on events (starts_at)
  where reminder_sent_at is null;
