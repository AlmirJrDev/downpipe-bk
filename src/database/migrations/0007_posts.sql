-- ==========================================================
-- 0007_posts.sql
-- Posts do feed social + suas mídias (múltiplas imagens/vídeos
-- por post, substituindo campos avulsos como imageUrl/before/after).
-- ==========================================================

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles (id) on delete cascade,
  -- opcional: nem todo post está associado a um carro
  car_id uuid references cars (id) on delete set null,

  type text not null default 'normal',
  title text,
  subtitle text,
  caption text,
  cost numeric(12, 2),
  progress_percent integer,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint chk_posts_type check (type in ('normal', 'project_update', 'evolution')),
  constraint chk_posts_cost check (cost is null or cost >= 0),
  constraint chk_posts_progress_percent check (
    progress_percent is null or progress_percent between 0 and 100
  )
);

create index if not exists idx_posts_author_id on posts (author_id);
create index if not exists idx_posts_car_id on posts (car_id);
create index if not exists idx_posts_created_at on posts (created_at desc);
create index if not exists idx_posts_type on posts (type);

drop trigger if exists trg_posts_updated_at on posts;
create trigger trg_posts_updated_at
  before update on posts
  for each row
  execute function set_updated_at();

alter table posts enable row level security;

drop policy if exists "posts_select_public" on posts;
create policy "posts_select_public"
  on posts for select
  using (true);

drop policy if exists "posts_insert_own" on posts;
create policy "posts_insert_own"
  on posts for insert
  to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "posts_update_own" on posts;
create policy "posts_update_own"
  on posts for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "posts_delete_own" on posts;
create policy "posts_delete_own"
  on posts for delete
  to authenticated
  using (auth.uid() = author_id);

-- ==========================================================
-- post_media
-- ==========================================================

create table if not exists post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  media_url text not null,
  media_type text not null,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),

  constraint chk_post_media_type check (media_type in ('image', 'video'))
);

create index if not exists idx_post_media_post_id on post_media (post_id);
create index if not exists idx_post_media_position on post_media (post_id, position);

alter table post_media enable row level security;

drop policy if exists "post_media_select_public" on post_media;
create policy "post_media_select_public"
  on post_media for select
  using (true);

drop policy if exists "post_media_insert_own_post" on post_media;
create policy "post_media_insert_own_post"
  on post_media for insert
  to authenticated
  with check (auth.uid() = (select author_id from posts where id = post_id));

drop policy if exists "post_media_update_own_post" on post_media;
create policy "post_media_update_own_post"
  on post_media for update
  to authenticated
  using (auth.uid() = (select author_id from posts where id = post_id))
  with check (auth.uid() = (select author_id from posts where id = post_id));

drop policy if exists "post_media_delete_own_post" on post_media;
create policy "post_media_delete_own_post"
  on post_media for delete
  to authenticated
  using (auth.uid() = (select author_id from posts where id = post_id));
