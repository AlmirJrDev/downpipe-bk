-- @ do Instagram no carro e no perfil.
--
-- No carro porque é assim que essa galera já se organiza: muita gente mantém
-- um perfil do build, sem nada de pessoal nele, e é esse @ que quer divulgar.
-- No perfil pra quem usa o Instagram pessoal mesmo. Texto puro, sem o "@" e
-- sem URL — o app monta o link.

alter table cars add column if not exists instagram text;
alter table profiles add column if not exists instagram text;
