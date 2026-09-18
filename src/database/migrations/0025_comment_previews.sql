-- ==========================================================
-- 0025_comment_previews.sql
-- Os comentários mais recentes de cada post, pra prévia no card do feed.
--
-- Pedir "os 2 últimos comentários de cada um destes 20 posts" não cabe numa
-- consulta simples: um limite comum valeria pro conjunto, não por post. A
-- janela (row_number por post) resolve isso de uma vez, sem uma consulta por
-- card.
--
-- Traz 3, embora o card mostre 2: se um dos três for de alguém que quem está
-- vendo bloqueou, ainda sobram dois pra mostrar.
--
-- security_invoker: a view respeita as permissões de quem consulta, e não as
-- de quem a criou. Sem isso, uma view fura o RLS da tabela de baixo.
-- ==========================================================

create or replace view comment_previews
with (security_invoker = true) as
select
  recentes.id,
  recentes.post_id,
  recentes.author_id,
  recentes.text,
  recentes.created_at,
  p.username
from (
  select
    c.id,
    c.post_id,
    c.author_id,
    c.text,
    c.created_at,
    row_number() over (partition by c.post_id order by c.created_at desc) as posicao
  from comments c
) recentes
join profiles p on p.id = recentes.author_id
where recentes.posicao <= 3;
