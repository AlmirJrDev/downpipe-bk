import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { list, create, update, remove } from './project-steps.controller';

// Rotas em /projects/:projectId/steps
const router = Router();

router.get('/:projectId/steps', list);
router.post('/:projectId/steps', requireAuth, create);
router.patch('/:projectId/steps/:stepId', requireAuth, update);
router.delete('/:projectId/steps/:stepId', requireAuth, remove);

export default router;
