import { z } from 'zod';

export const listActiveAdsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export type ListActiveAdsQuery = z.infer<typeof listActiveAdsQuerySchema>;
