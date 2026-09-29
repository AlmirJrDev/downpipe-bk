-- ==========================================================
-- 0037_miniatura_do_role.sql
-- A miniatura da arte do rolê, pro pino do mapa.
--
-- O pino mostra o cartaz em 44 px, e baixava a arte em resolução cheia pra
-- isso — de 300 KB a 1 MB cada. Abrir o mapa com vinte rolês no 4G era
-- baixar dez megas pra desenhar vinte bolinhas.
--
-- A miniatura é gerada por nós na hora em que a foto é salva, e guardada ao
-- lado dela. Dava pra pedir o redimensionamento ao Storage na hora, mas isso
-- só existe no plano pago do Supabase e cobra por imagem: o mapa não pode
-- parar de funcionar por causa do plano.
-- ==========================================================

alter table events
  add column if not exists photo_thumb_url text;

comment on column events.photo_thumb_url is
  'Miniatura quadrada da arte (128 px), usada no pino do mapa. Null quando não há foto ou a geração falhou — a tela cai na foto cheia.';
