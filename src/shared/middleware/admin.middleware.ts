import { NextFunction, Request, Response } from 'express';
import { AppError } from '@/shared/utils/AppError';
import { moderationRepository } from '@/modules/moderation/moderation.repository';

/**
 * Só quem está na tabela `admins` passa. Vai sempre depois do requireAuth.
 *
 * A checagem é no banco a cada requisição, e não numa marca dentro do token:
 * tirar alguém da moderação tem que valer na hora, não no próximo login.
 *
 * Responde 404 em vez de 403 de propósito — pra quem não modera, a área de
 * moderação não existe, e um 403 confirmaria que existe.
 */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized('Token de autenticação ausente');
    const ehAdmin = await moderationRepository.isAdmin(req.user.id);
    if (!ehAdmin) throw AppError.notFound('NOT_FOUND', 'Não encontrado');
    next();
  } catch (err) {
    next(err);
  }
}
