-- ==========================================================
-- 0033_eventos_detalhados.sql
-- O que o rolê oferece, o que ele pede e o que ele proíbe.
--
-- Um encontro de verdade não é só nome, hora e lugar. Quem está decidindo se
-- vai quer saber se tem food truck, se leva as crianças, se precisa levar 1 kg
-- de alimento, até que horas vai, se o carro dele é do tipo que o pessoal
-- espera ali, e — o que mais gera briga — o que NÃO pode: som alto, acelerar
-- no posto, arrancada, borrachão.
--
-- Listas em text[], com o vocabulário do lado do app: são rótulos de tela, não
-- entidades. Tabela separada obrigaria um join pra mostrar três chips, e um
-- enum no banco viraria migration toda vez que a cena inventar uma categoria.
-- O backend valida contra a mesma lista (events.schema.ts).
-- ==========================================================

alter table events
  -- Fim do rolê. Quase sempre é palpite ("por volta das 22h"), e o app mostra
  -- diferente quando é estimativa — prometer hora certa que não existe é pior
  -- do que não prometer nada.
  add column if not exists ends_at timestamptz,
  add column if not exists ends_at_estimated boolean not null default false,

  -- "1 kg de alimento não perecível", "R$ 10 por carro", "entrada franca".
  -- Texto livre porque cada encontro pede de um jeito.
  add column if not exists entry_note text,

  -- O que tem lá: food truck, brinquedo pra criança, loja expondo, som, etc.
  add column if not exists attractions text[] not null default '{}',

  -- O que não pode. É a informação que evita o rolê acabar cedo com o dono do
  -- posto expulsando todo mundo.
  add column if not exists rules text[] not null default '{}',

  -- Que tipo de encontro é: exposição, drift, arrancada, passeio, off-road.
  add column if not exists kind text,

  -- Carros esperados, nas mesmas categorias que os carros do app usam. Vazio
  -- significa "qualquer carro" — que é a maioria dos encontros.
  add column if not exists car_categories text[] not null default '{}';

comment on column events.ends_at is 'Fim previsto. Ver ends_at_estimated.';
comment on column events.car_categories is 'Vazio = qualquer carro. Valida a presença em events.service.';
