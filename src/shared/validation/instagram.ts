import { z } from 'zod';

/**
 * @ do Instagram, guardado sempre puro: sem "@", sem URL, minúsculo.
 *
 * As pessoas colam de tudo nesse campo — "@meucarro", "instagram.com/meucarro",
 * a URL inteira com "?igsh=..." do botão de compartilhar. Normalizar na entrada
 * é o que deixa o resto do sistema (link do perfil, arte de story) tratar isso
 * como um nome só.
 */
export const instagramSchema = z.preprocess(
  (valor) => {
    if (typeof valor !== 'string') return valor;
    const limpo = valor
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/^instagram\.com\//i, '')
      .replace(/^@/, '')
      .split(/[/?#]/)[0]
      .toLowerCase();
    // Campo esvaziado na edição é "quero tirar", não string vazia inválida.
    return limpo === '' ? null : limpo;
  },
  z
    .string()
    .max(30, 'O @ do Instagram tem no máximo 30 caracteres')
    .regex(/^[a-z0-9_.]+$/, 'O @ do Instagram só tem letras, números, "_" e "."')
    .nullable()
    .optional()
);
