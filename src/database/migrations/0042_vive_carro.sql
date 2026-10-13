-- ==========================================================
-- 0042_vive_carro.sql
-- "Como você vive carro?", a primeira pergunta do onboarding.
--
-- Múltipla escolha: tenho carro, fotografo, organizo encontros, curto mas
-- sem carro. O perfil principal decide a próxima tela do onboarding, e
-- todos os marcados montam o "Comece por aqui" do feed. Fica no perfil (e
-- não no aparelho) pra valer em qualquer celular e pra dar pra ver que
-- tipo de gente está chegando.
--
-- Conta antiga fica com a lista vazia e o app mostra o checklist de antes.
-- ==========================================================

alter table profiles
  add column if not exists vive_carro text[] not null default '{}';

alter table profiles
  drop constraint if exists chk_profiles_vive_carro;
alter table profiles
  add constraint chk_profiles_vive_carro
  check (vive_carro <@ array['carro', 'fotografo', 'organizador', 'sem_carro']::text[]);

comment on column profiles.vive_carro is
  'Como a pessoa vive carro (onboarding): carro, fotografo, organizador, sem_carro. Vazio em conta de antes da pergunta.';
