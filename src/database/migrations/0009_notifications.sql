-- ==========================================================
-- 0009_notifications.sql
-- Estrutura inicial de notificações in-app (sem push, por ora).
-- ==========================================================

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles (id) on delete cascade,
  actor_id uuid not null references profiles (id) on delete cascade,
  type text not null,
  post_id uuid references posts (id) on delete cascade,
  comment_id uuid references comments (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz,

  constraint chk_notifications_type check (type in ('like', 'comment', 'follow', 'project_update'))
);

create index if not exists idx_notifications_recipient_id on notifications (recipient_id);
create index if not exists idx_notifications_recipient_unread
  on notifications (recipient_id)
  where read_at is null;
create index if not exists idx_notifications_created_at on notifications (created_at desc);

alter table notifications enable row level security;

-- Notificações são privadas: só o destinatário pode ver as suas.
drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own"
  on notifications for select
  to authenticated
  using (auth.uid() = recipient_id);

-- Inserção só acontece via backend (service role, que ignora RLS) quando
-- eventos de like/comment/follow/project_update ocorrem — não há policy de
-- insert para o role "authenticated".

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own"
  on notifications for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);
