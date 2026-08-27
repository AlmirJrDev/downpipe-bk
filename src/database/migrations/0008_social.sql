-- ==========================================================
-- 0008_social.sql
-- Curtidas, comentários e relações de "seguir" entre usuários.
-- ==========================================================

create table if not exists post_likes (
  post_id uuid not null references posts (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),

  primary key (post_id, user_id)
);

create index if not exists idx_post_likes_post_id on post_likes (post_id);
create index if not exists idx_post_likes_user_id on post_likes (user_id);

alter table post_likes enable row level security;

drop policy if exists "post_likes_select_public" on post_likes;
create policy "post_likes_select_public"
  on post_likes for select
  using (true);

drop policy if exists "post_likes_insert_own" on post_likes;
create policy "post_likes_insert_own"
  on post_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "post_likes_delete_own" on post_likes;
create policy "post_likes_delete_own"
  on post_likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- ==========================================================
-- comments
-- ==========================================================

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint chk_comments_text check (char_length(text) between 1 and 1000)
);

create index if not exists idx_comments_post_id on comments (post_id);
create index if not exists idx_comments_author_id on comments (author_id);
create index if not exists idx_comments_created_at on comments (created_at);

drop trigger if exists trg_comments_updated_at on comments;
create trigger trg_comments_updated_at
  before update on comments
  for each row
  execute function set_updated_at();

alter table comments enable row level security;

drop policy if exists "comments_select_public" on comments;
create policy "comments_select_public"
  on comments for select
  using (true);

drop policy if exists "comments_insert_own" on comments;
create policy "comments_insert_own"
  on comments for insert
  to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "comments_update_own" on comments;
create policy "comments_update_own"
  on comments for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "comments_delete_own" on comments;
create policy "comments_delete_own"
  on comments for delete
  to authenticated
  using (auth.uid() = author_id);

-- ==========================================================
-- follows
-- ==========================================================

create table if not exists follows (
  follower_id uuid not null references profiles (id) on delete cascade,
  following_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),

  primary key (follower_id, following_id),
  constraint chk_follows_not_self check (follower_id <> following_id)
);

create index if not exists idx_follows_follower_id on follows (follower_id);
create index if not exists idx_follows_following_id on follows (following_id);

alter table follows enable row level security;

drop policy if exists "follows_select_public" on follows;
create policy "follows_select_public"
  on follows for select
  using (true);

drop policy if exists "follows_insert_own" on follows;
create policy "follows_insert_own"
  on follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

drop policy if exists "follows_delete_own" on follows;
create policy "follows_delete_own"
  on follows for delete
  to authenticated
  using (auth.uid() = follower_id);
