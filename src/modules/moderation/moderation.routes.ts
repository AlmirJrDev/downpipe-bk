import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { requireAdmin } from '@/shared/middleware/admin.middleware';
import {
  createReport,
  block,
  unblock,
  listBlocked,
  listReports,
  countReports,
  reviewReport,
  removeTarget,
} from './moderation.controller';

/** POST /reports */
export const reportsRouter = Router();
reportsRouter.post('/', requireAuth, createReport);

/** /profiles/:userId/block — mesmo formato do seguir, que já vive em /profiles. */
export const blocksRouter = Router();
blocksRouter.post('/:userId/block', requireAuth, block);
blocksRouter.delete('/:userId/block', requireAuth, unblock);

/**
 * /admin — a fila de denúncias e as ações em cima dela.
 *
 * Tudo aqui passa por requireAdmin, que responde 404 pra quem não modera:
 * a área não existe pra quem não é da casa.
 */
export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);
adminRouter.get('/reports', listReports);
adminRouter.get('/reports/count', countReports);
adminRouter.post('/reports/:id/review', reviewReport);
adminRouter.delete('/targets/:tipo/:id', removeTarget);

/** GET /profile/blocks — a lista é do próprio usuário, no singular como o resto. */
export const myBlocksRouter = Router();
myBlocksRouter.get('/blocks', requireAuth, listBlocked);
