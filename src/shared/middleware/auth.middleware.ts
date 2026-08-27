import { NextFunction, Request, Response } from 'express';
import { supabaseAnon } from '@/config/supabase';
import { AppError } from '@/shared/utils/AppError';

/**
 * Extrai e valida o JWT enviado no header Authorization: Bearer <token>.
 * Em caso de sucesso, popula req.user e req.accessToken.
 *
 * Nunca confiar em qualquer owner_id/author_id/user_id vindo do corpo da
 * requisição - toda a aplicação deve usar req.user.id como fonte de verdade.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Token de autenticação ausente');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    const { data, error } = await supabaseAnon.auth.getUser(token);

    if (error || !data.user) {
      throw AppError.unauthorized('Token de autenticação inválido ou expirado');
    }

    req.user = { id: data.user.id, email: data.user.email ?? null };
    req.accessToken = token;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Versão "opcional": popula req.user quando um token válido é enviado, mas
 * não bloqueia a requisição quando ausente. Útil em endpoints públicos que
 * variam a resposta quando o usuário está autenticado (ex.: liked_by_me).
 */
export async function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data } = await supabaseAnon.auth.getUser(token);

    if (data.user) {
      req.user = { id: data.user.id, email: data.user.email ?? null };
      req.accessToken = token;
    }

    next();
  } catch {
    // Token inválido em rota opcional apenas segue como não autenticado.
    next();
  }
}
