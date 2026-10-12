/**
 * Relatos de experiência: quem usa conta como tá sendo, quem modera lê.
 *
 * POST /feedback        — qualquer pessoa logada manda um relato.
 * GET  /admin/feedback  — a lista, mais novos primeiro (só quem modera).
 * GET  /admin/feedback/count — quantos ainda não foram lidos.
 * POST /admin/feedback/:id/read — marca como lido.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '@/config/supabase';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { requireAdmin } from '@/shared/middleware/admin.middleware';
import { limiteRelato } from '@/shared/middleware/rateLimit.middleware';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';

export const createFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  message: z
    .string()
    .trim()
    .min(1, 'Escreve alguma coisa — nem que seja uma linha.')
    .max(4000, 'Ficou longo demais. Corta um pouco e manda.'),
  canContact: z.boolean().optional(),
});

/**
 * "Celular · Chrome" a partir do user-agent. O texto inteiro não serve pra
 * nada na hora de ler o relato e ainda carrega versão de sistema que não
 * precisamos guardar.
 */
export function aparelho(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  const tipo = /iphone|android.*mobile|mobile/.test(ua) ? 'Celular' : /ipad|tablet|android/.test(ua) ? 'Tablet' : 'Computador';
  const sistema = /iphone|ipad|ios/.test(ua) ? 'iOS' : /android/.test(ua) ? 'Android' : /windows/.test(ua) ? 'Windows' : /mac os/.test(ua) ? 'Mac' : null;
  const navegador = /edg\//.test(ua)
    ? 'Edge'
    : /samsungbrowser/.test(ua)
      ? 'Samsung Internet'
      : /crios|chrome\//.test(ua)
        ? 'Chrome'
        : /fxios|firefox/.test(ua)
          ? 'Firefox'
          : /safari/.test(ua)
            ? 'Safari'
            : null;
  return [tipo, sistema, navegador].filter(Boolean).join(' · ');
}

const idSchema = z.object({ id: z.string().uuid() });

export const feedbackRouter = Router();
feedbackRouter.post('/', requireAuth, limiteRelato, async (req: Request, res, next) => {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = createFeedbackSchema.parse(req.body);
    const { error } = await supabaseAdmin.from('feedback').insert({
      user_id: req.user.id,
      rating: input.rating ?? null,
      message: input.message,
      can_contact: input.canContact ?? false,
      device: aparelho(req.get('user-agent')),
    });
    if (error) throw error;
    sendSuccess(res, { ok: true }, 201);
  } catch (err) {
    next(err);
  }
});

export const adminFeedbackRouter = Router();
adminFeedbackRouter.use(requireAuth, requireAdmin);
adminFeedbackRouter.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('feedback')
      .select('id, rating, message, can_contact, device, read_at, created_at, profiles ( username, avatar_url )')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    sendSuccess(
      res,
      (data ?? []).map((r) => {
        const perfil = r.profiles as unknown as { username: string; avatar_url: string | null } | null;
        return {
          id: r.id,
          rating: r.rating,
          message: r.message,
          canContact: r.can_contact,
          device: r.device,
          readAt: r.read_at,
          createdAt: r.created_at,
          username: perfil?.username ?? null,
          avatarUrl: perfil?.avatar_url ?? null,
        };
      })
    );
  } catch (err) {
    next(err);
  }
});
adminFeedbackRouter.get('/count', async (_req, res, next) => {
  try {
    const { count, error } = await supabaseAdmin
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);
    if (error) throw error;
    sendSuccess(res, count ?? 0);
  } catch (err) {
    next(err);
  }
});
adminFeedbackRouter.post('/:id/read', async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params);
    const { error } = await supabaseAdmin
      .from('feedback')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null);
    if (error) throw error;
    sendSuccess(res, { ok: true });
  } catch (err) {
    next(err);
  }
});
