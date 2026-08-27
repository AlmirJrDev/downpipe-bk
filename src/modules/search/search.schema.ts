import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Parâmetro de busca "q" é obrigatório').max(100),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
