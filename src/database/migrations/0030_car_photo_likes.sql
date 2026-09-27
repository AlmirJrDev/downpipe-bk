-- ==========================================================
-- 0030_car_photo_likes.sql
-- Quantas curtidas as fotos de um carro somam.
--
-- O card do Explorar mostrava uma contagem de curtidas inventada a partir do
-- id do carro. Carro não tem curtida — mas as fotos dele têm, e somá-las diz
-- a mesma coisa sem inventar nada: é o carro que a galera curte.
--
-- View, e não coluna mantida por trigger: o número muda a cada curtida, é
-- barato de calcular com os índices que já existem, e coluna denormalizada
-- aqui significaria acertar o contador em toda curtida, descurtida, post
-- apagado e marcação de carro aceita ou recusada.
--
-- Só entram fotos com a marcação aceita (`car_tag_status = 'approved'`), que
-- é a mesma regra da página do carro: foto marcada por outra pessoa e ainda
-- não aprovada pelo dono não conta.
-- ==========================================================

create or replace view car_photo_likes
with (security_invoker = true) as
select
  p.car_id,
  count(l.post_id)::int as likes
from posts p
join post_likes l on l.post_id = p.id
where p.car_id is not null
  and p.car_tag_status = 'approved'
group by p.car_id;
