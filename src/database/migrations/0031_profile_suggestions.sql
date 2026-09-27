-- ==========================================================
-- 0031_profile_suggestions.sql
-- Quem sugerir pra alguém seguir.
--
-- O feed cai no global quando a pessoa não segue ninguém, então o novato
-- nunca vê tela vazia — mas o vínculo não nasce sozinho: ela olha fotos de
-- estranhos e vai embora sem seguir ninguém, e na próxima semana o feed
-- continua igual.
--
-- A view só reúne os números que dizem "esta conta tem o que mostrar"
-- (carros, publicações, última publicação). Quem filtrar (eu mesmo, quem já
-- sigo, quem bloqueei) e ordenar é o backend, porque isso depende de quem
-- está perguntando.
--
-- Contas que nunca escolheram um @ ficam de fora: o username placeholder do
-- signup ('u' + 24 caracteres do id) é sinal de conta que parou no meio do
-- cadastro, e sugerir isso é pior do que não sugerir nada.
-- ==========================================================

create or replace view profile_suggestions
with (security_invoker = true) as
select
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.is_organizer,
  (select count(*) from cars c where c.owner_id = p.id)::int as cars_count,
  (select count(*) from posts po where po.author_id = p.id)::int as posts_count,
  (select max(po.created_at) from posts po where po.author_id = p.id) as last_post_at
from profiles p
where p.username !~ '^u[0-9a-f]{24}$';
