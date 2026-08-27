/**
 * Erro de domínio/aplicação. Todo erro esperado (regra de negócio, validação,
 * autorização, recurso não encontrado) deve ser lançado como AppError para que
 * o error.middleware saiba como formatá-lo na resposta padrão da API.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  static notFound(code: string, message: string) {
    return new AppError(code, message, 404);
  }

  static unauthorized(message = 'Não autenticado') {
    return new AppError('UNAUTHORIZED', message, 401);
  }

  static forbidden(message = 'Você não tem permissão para realizar esta ação') {
    return new AppError('FORBIDDEN', message, 403);
  }

  static conflict(code: string, message: string) {
    return new AppError(code, message, 409);
  }

  static validation(message: string, details?: unknown) {
    return new AppError('VALIDATION_ERROR', message, 422, details);
  }

  static internal(message = 'Erro interno do servidor') {
    return new AppError('INTERNAL_ERROR', message, 500);
  }
}
