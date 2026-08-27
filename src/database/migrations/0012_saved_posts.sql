-- ==========================================================
-- 0012_saved_posts.sql
-- Posts salvos ("bookmark"). Mesma forma de post_likes, com uma
-- diferença importante: curtida é pública (qualquer um lista quem
-- curtiu), salvamento é privado — só o próprio dono enxerga.
-- Por isso não existe policy de select público aqui.
-- ==========================================================

create table if not exists saved_posts (
  post_id uuid not null references posts (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),

  primary key (post_id, user_id)
);

create index if not exists idx_saved_posts_post_id on saved_posts (post_id);
-- Ordena "meus salvos" do mais recente pro mais antigo.
create index if not exists idx_saved_posts_user_created on saved_posts (user_id, created_at desc);

alter table saved_posts enable row level security;

drop policy if exists "saved_posts_select_own" on saved_posts;
create policy "saved_posts_select_own"
  on saved_posts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "saved_posts_insert_own" on saved_posts;
create policy "saved_posts_insert_own"
  on saved_posts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "saved_posts_delete_own" on saved_posts;
create policy "saved_posts_delete_own"
  on saved_posts for delete
  to authenticated
  using (auth.uid() = user_id);
