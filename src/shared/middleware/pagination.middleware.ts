import { Request } from 'express';
import { z } from 'zod';

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Extrai e valida page/limit de req.query. Usado por todos os endpoints que
 * retornam listas, garantindo que nenhum endpoint devolva registros sem limite.
 */
export function parsePagination(req: Request): PaginationParams {
  const { page, limit } = paginationQuerySchema.parse(req.query);
  return { page, limit, offset: (page - 1) * limit };
}

export function buildPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    hasNextPage: page * limit < total,
  };
}
