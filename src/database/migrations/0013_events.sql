-- ==========================================================
-- 0013_events.sql
-- Encontros/rolês: quem organiza publica, quem vai confirma presença.
--
-- A foto do evento vai no bucket "posts", que já existe e já tem as
-- policies de storage certas (0004_cars.sql). Criar um bucket próprio
-- exigiria recriar aquelas policies só para acrescentar um nome — não
-- compensa enquanto a foto é uma imagem como qualquer outra.
-- ==========================================================

-- Marca de organizador no perfil que já existe, em vez de um segundo tipo
-- de conta: quem organiza encontro muitas vezes também tem carro, e duas
-- contas obrigariam a pessoa a manter dois logins. Perfil marcado mostra
-- os eventos em destaque; perfil sem carro simplesmente não mostra garagem,
-- que é o comportamento que o app já tem.
alter table profiles add column if not exists is_organizer boolean not null default false;

-- ==========================================================

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references profiles (id) on delete cascade,

  name text not null,
  description text,
  starts_at timestamptz not null,
  location text not null,
  city text not null,
  photo_url text,

  -- 'public' entra no calendário; 'link' não aparece em listagem nenhuma e
  -- só é alcançado por quem tem o id. É de propósito que não existe lista
  -- de convidados: a turma compartilha link no grupo do WhatsApp, e uma
  -- tabela de convite/aceite seria complexidade sem uso real.
  visibility text not null default 'public',

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint chk_events_visibility check (visibility in ('public', 'link')),
  constraint chk_events_name_length check (char_length(name) between 1 and 120),
  constraint chk_events_city_length check (char_length(city) between 1 and 80)
);

create index if not exists idx_events_organizer_id on events (organizer_id);
-- Índice da consulta principal: próximos eventos públicos de uma cidade.
create index if not exists idx_events_visibility_city_starts
  on events (visibility, city, starts_at);
create index if not exists idx_events_starts_at on events (starts_at);

drop trigger if exists trg_events_updated_at on events;
create trigger trg_events_updated_at
  before update on events
  for each row
  execute function set_updated_at();

alter table events enable row level security;

-- Leitura direta só dos públicos (e dos próprios). Evento 'link' é servido
-- pela API por id — o backend usa service role e não passa por estas
-- policies; elas existem como defesa caso alguém consulte o banco direto.
drop policy if exists "events_select_public" on events;
create policy "events_select_public"
  on events for select
  using (visibility = 'public' or auth.uid() = organizer_id);

drop policy if exists "events_insert_own" on events;
create policy "events_insert_own"
  on events for insert
  to authenticated
  with check (auth.uid() = organizer_id);

drop policy if exists "events_update_own" on events;
create policy "events_update_own"
  on events for update
  to authenticated
  using (auth.uid() = organizer_id);

drop policy if exists "events_delete_own" on events;
create policy "events_delete_own"
  on events for delete
  to authenticated
  using (auth.uid() = organizer_id);

-- ==========================================================
-- Presença — mesma forma de post_likes: par (evento, usuário) sem id
-- próprio, porque a linha É a relação.
-- ==========================================================

create table if not exists event_attendees (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),

  primary key (event_id, user_id)
);

create index if not exists idx_event_attendees_event_id on event_attendees (event_id);
create index if not exists idx_event_attendees_user_id on event_attendees (user_id);

alter table event_attendees enable row level security;

-- Presença é pública: saber quem vai é justamente o que dá valor ao
-- evento (ao contrário de saved_posts, que é privado).
drop policy if exists "event_attendees_select_public" on event_attendees;
create policy "event_attendees_select_public"
  on event_attendees for select
  using (true);

drop policy if exists "event_attendees_insert_own" on event_attendees;
create policy "event_attendees_insert_own"
  on event_attendees for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "event_attendees_delete_own" on event_attendees;
create policy "event_attendees_delete_own"
  on event_attendees for delete
  to authenticated
  using (auth.uid() = user_id);

-- ==========================================================
-- Notificação de presença: "alguém que você segue vai nesse evento".
-- ==========================================================

alter table notifications add column if not exists event_id uuid references events (id) on delete cascade;

alter table notifications drop constraint if exists chk_notifications_type;
alter table notifications add constraint chk_notifications_type
  check (type in ('like', 'comment', 'follow', 'project_update', 'event_attend'));
