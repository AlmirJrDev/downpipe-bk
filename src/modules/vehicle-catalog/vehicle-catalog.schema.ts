import { z } from 'zod';

export const uuidParamSchema = z.object({
  id: z.string().uuid('id inválido'),
});

export const brandIdParamSchema = z.object({
  brandId: z.string().uuid('brandId inválido'),
});

export const modelIdParamSchema = z.object({
  modelId: z.string().uuid('modelId inválido'),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Parâmetro de busca "q" é obrigatório').max(100),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
