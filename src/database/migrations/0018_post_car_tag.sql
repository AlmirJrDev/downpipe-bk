-- ==========================================================
-- 0018_post_car_tag.sql
-- Marcar o carro de outra pessoa numa publicação.
--
-- Até aqui o backend recusava (403) marcar carro alheio. Isso fechava a
-- porta pra quem mais produz conteúdo em encontro: o fotógrafo, que
-- fotografa o carro dos outros e hoje não tem onde postar isso.
--
-- A publicação sai na hora; só o VÍNCULO com o carro espera aprovação do
-- dono. Assim o fotógrafo não fica bloqueado e a página do carro não
-- recebe nada sem o dono deixar.
--
--   'approved' — o autor é o dono do carro, ou o dono aceitou
--   'pending'  — marcou carro de outra pessoa, esperando resposta
--
-- Recusar não guarda estado: limpa car_id e o status. Guardar "recusado"
-- só serviria pra alguém ficar remoendo, e o dado não tem uso.
-- ==========================================================

alter table posts add column if not exists car_tag_status text;

alter table posts drop constraint if exists chk_posts_car_tag_status;
alter table posts add constraint chk_posts_car_tag_status
  check (car_tag_status is null or car_tag_status in ('approved', 'pending'));

-- Publicações que já existem são todas do próprio dono (a trava antiga
-- garantia isso), então entram como aprovadas.
update posts set car_tag_status = 'approved'
  where car_id is not null and car_tag_status is null;

-- Consulta principal: fotos aprovadas de um carro, da mais recente pra
-- mais antiga.
create index if not exists idx_posts_car_approved
  on posts (car_id, created_at desc)
  where car_id is not null and car_tag_status = 'approved';

-- Quinto e sexto tipos de notificação: marcaram seu carro / aceitaram.
alter table notifications drop constraint if exists chk_notifications_type;
alter table notifications add constraint chk_notifications_type
  check (type in ('like', 'comment', 'follow', 'project_update', 'event_attend', 'car_tag'));
