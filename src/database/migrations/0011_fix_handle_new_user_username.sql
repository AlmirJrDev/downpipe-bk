-- ==========================================================
-- 0011_fix_handle_new_user_username.sql
-- Corrige handle_new_user(): o username placeholder gerado
-- ('user_' + uuid sem hífens, 37 caracteres) violava o check
-- constraint username_format (^[a-z0-9_.]{3,30}$), fazendo TODO
-- signup falhar com "Database error saving new user" — o insert
-- em auth.users é revertido junto quando o trigger AFTER INSERT
-- lança exceção, então nenhuma linha órfã ficou pra trás.
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
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Novo Gearhead')
  );
  return new;
end;
$$ language plpgsql security definer;
