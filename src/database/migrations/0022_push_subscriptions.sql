-- ==========================================================
-- 0022_push_subscriptions.sql
-- Onde entregar notificação push — um endpoint por aparelho/navegador em
-- que a pessoa autorizou.
--
-- Uma conta pode ter várias linhas (celular e computador, por exemplo);
-- por isso a chave não é user_id, é o endpoint em si — é o que o
-- navegador usa pra identificar a inscrição, e reinscrever no mesmo
-- aparelho deve atualizar a linha, não duplicar.
-- ==========================================================

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,

  -- Endereço do serviço de push do navegador (FCM, Apple Push...). É o que
  -- o servidor chama pra entregar — não tem nada a ver com o endpoint da
  -- nossa própria API.
  endpoint text not null unique,
  -- Chaves de criptografia da inscrição, exigidas pelo protocolo Web Push
  -- pra cifrar o payload — sem elas o serviço de push recusa o envio.
  p256dh text not null,
  auth text not null,

  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_push_subscriptions_user_id on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Só inserir e apagar a própria: o app nunca precisa LER uma inscrição de
-- volta (não existe tela "meus aparelhos inscritos" ainda), só criar ao
-- pedir permissão e apagar ao revogar. O envio em si roda com service role
-- e não passa por RLS.
drop policy if exists "push_subscriptions_insert_own" on push_subscriptions;
create policy "push_subscriptions_insert_own"
  on push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on push_subscriptions;
create policy "push_subscriptions_delete_own"
  on push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);
