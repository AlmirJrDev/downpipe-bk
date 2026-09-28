import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { requireAdmin } from '@/shared/middleware/admin.middleware';
import { suggest, list, count, approve, reject } from './event-suggestions.controller';

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
