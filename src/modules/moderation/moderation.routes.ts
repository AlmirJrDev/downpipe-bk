import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { createReport, block, unblock, listBlocked } from './moderation.controller';

/** POST /reports */
export const reportsRouter = Router();
reportsRouter.post('/', requireAuth, createReport);

/** /profiles/:userId/block — mesmo formato do seguir, que já vive em /profiles. */
export const blocksRouter = Router();
blocksRouter.post('/:userId/block', requireAuth, block);
blocksRouter.delete('/:userId/block', requireAuth, unblock);

/** GET /profile/blocks — a lista é do próprio usuário, no singular como o resto. */
export const myBlocksRouter = Router();
myBlocksRouter.get('/blocks', requireAuth, listBlocked);
