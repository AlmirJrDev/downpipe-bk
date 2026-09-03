-- ==========================================================
-- 0021_event_address.sql
-- Endereço separado do nome do lugar, em rolês.
--
-- `location` sempre foi "como o pessoal chama o lugar" (ex: "Posto Graal"),
-- mas também era o único campo pra endereço — então marcar o ponto no mapa
-- ou preenchia por cima do nome digitado, ou (se o campo já tinha texto)
-- não preenchia nada e o endereço resolvido pela geocodificação reversa
-- era descartado. As duas opções são ruins: quem não conhece "o Graal" fica
-- sem saber onde é, e quem digitou o nome perde o trabalho.
--
-- `address` é a rua e número que o pino no mapa resolve — complementar ao
-- nome, não substituto. Nullable porque nem todo evento tem coordenada
-- (o organizador pode não marcar o mapa), e string livre porque o texto
-- vem do Nominatim, não de um formulário estruturado.
-- ==========================================================

alter table events add column if not exists address text;
