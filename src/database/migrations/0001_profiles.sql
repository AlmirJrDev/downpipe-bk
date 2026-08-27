-- ==========================================================
-- 0001_profiles.sql
-- Extensões básicas + tabela profiles + trigger de criação
-- automática a partir de auth.users + RLS
-- ==========================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------
-- Função utilitária para manter updated_at sempre atualizado
-- ----------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

-- ----------------------------------------------------------
-- Tabela profiles
-- ----------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null,
  bio text,
  avatar_url text,
  gearhead_since integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint username_format check (username ~ '^[a-z0-9_.]{3,30}$'),
  constraint display_name_length check (char_length(display_name) between 1 and 60),
  constraint gearhead_since_range check (
    gearhead_since is null or gearhead_since between 1900 and extract(year from now())::int
  )
);

create index if not exists idx_profiles_username on profiles (username);

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
  before update on profiles
  for each row
  execute function set_updated_at();

-- ----------------------------------------------------------
-- Trigger: cria automaticamente um profile quando um novo
-- usuário é criado em auth.users
-- ----------------------------------------------------------
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    -- username temporário e único derivado do id; o usuário deve
    -- customizar depois via PATCH /profile/me
    'user_' || replace(new.id::text, '-', ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Novo Gearhead')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- ----------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------
alter table profiles enable row level security;

-- Qualquer pessoa (autenticada ou não) pode visualizar profiles públicos.
drop policy if exists "profiles_select_public" on profiles;
create policy "profiles_select_public"
  on profiles for select
  using (true);

-- Usuário só pode atualizar o próprio profile.
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Inserts em profiles acontecem apenas via trigger (security definer),
-- então não expomos policy de insert para usuários comuns.
