import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { AppError } from '@/shared/utils/AppError';
import { sendError } from '@/shared/utils/apiResponse';

export function notFoundHandler(req: Request, res: Response) {
  sendError(res, 404, 'ROUTE_NOT_FOUND', `Rota ${req.method} ${req.path} não encontrada`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Dados inválidos', err.flatten());
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Arquivo muito grande. Máximo permitido: 5MB.'
        : `Falha no upload do arquivo: ${err.message}`;
    return sendError(res, 422, 'UPLOAD_ERROR', message);
  }

  // Erros lançados pelo fileFilter do multer (ex.: tipo de arquivo inválido)
  // chegam aqui como Error genérico.
  if (err instanceof Error && err.message.startsWith('Tipo de arquivo não permitido')) {
    return sendError(res, 422, 'INVALID_FILE_TYPE', err.message);
  }

  // eslint-disable-next-line no-console
  console.error('Erro não tratado:', err);
  return sendError(res, 500, 'INTERNAL_ERROR', 'Erro interno do servidor');
}
