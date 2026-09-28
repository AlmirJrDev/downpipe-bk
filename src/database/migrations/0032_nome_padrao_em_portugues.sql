-- ==========================================================
-- 0032_nome_padrao_em_portugues.sql
-- O nome que a conta nova ganha antes de a pessoa escolher o dela.
--
-- Era "Novo Gearhead". "Gearhead" é gíria americana: aqui ninguém se
-- apresenta assim, e o nome aparecia na tela até a pessoa passar pelo
-- onboarding. O resto do app já foi traduzido junto com esta migration —
-- "build" virou "projeto", "em building" virou "em andamento".
--
-- Só a função muda. Nenhum perfil hoje está com o nome padrão (conferido
-- antes de escrever isto), então não há linha pra corrigir.
-- ==========================================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    -- 'u' + 24 chars do id (sem hífens) = 25 caracteres, dentro do
    -- limite de 30 do username_format. O usuário troca depois via
    -- PATCH /profile/me.
    'u' || substr(replace(new.id::text, '-', ''), 1, 24),
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Novo por aqui')
  );
  return new;
end;
$$ language plpgsql security definer;
