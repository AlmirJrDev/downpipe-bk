import { Response } from 'express';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
}

/**
 * Todas as respostas de sucesso da API seguem o formato:
 * { data: T, error: null } ou, para listas paginadas,
 * { data: T[], pagination: {...}, error: null }
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ data, error: null });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  statusCode = 200
) {
  return res.status(statusCode).json({ data, pagination, error: null });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
) {
  return res.status(statusCode).json({
    data: null,
    error: { code, message, ...(details ? { details } : {}) },
  });
}
