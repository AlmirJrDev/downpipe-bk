import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { requireAdmin } from '@/shared/middleware/admin.middleware';
import { suggest, list, count, approve, reject, photo } from './event-suggestions.controller';
import { linksDeEncontro, novoLinkSchema } from './links';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';

/**
 * POST /events/suggestions — qualquer pessoa logada avisa de um rolê que viu.
 * Fica em /events porque é disso que se trata; a fila em si é área de quem
 * modera.
 */
export const suggestionsRouter = Router();
suggestionsRouter.post('/suggestions', requireAuth, suggest);

/** /admin/suggestions — a fila, e o que fazer com ela. */
export const adminSuggestionsRouter = Router();
adminSuggestionsRouter.use(requireAuth, requireAdmin);
adminSuggestionsRouter.get('/', list);
adminSuggestionsRouter.get('/count', count);
adminSuggestionsRouter.post('/:id/approve', approve);
adminSuggestionsRouter.post('/:id/reject', reject);
adminSuggestionsRouter.post('/:id/photo', photo);

/**
 * /admin/suggestions/links — a caixa de links (ver links.ts). Antes do
 * "/:id/..." não importa aqui (métodos e caminhos não colidem), mas fica
 * junto da fila porque é a porta de entrada dela.
 */
adminSuggestionsRouter.get('/links', async (_req, res, next) => {
  try {
    sendSuccess(res, await linksDeEncontro.listar());
  } catch (err) {
    next(err);
  }
});
adminSuggestionsRouter.post('/links', async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = novoLinkSchema.parse(req.body);
    sendSuccess(res, await linksDeEncontro.guardar(input, req.user.id), 201);
  } catch (err) {
    next(err);
  }
});
