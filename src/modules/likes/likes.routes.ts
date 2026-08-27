import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { like, unlike, listLikers } from './likes.controller';

// Rotas em /posts/:postId/like(s)
const router = Router();

router.post('/:postId/like', requireAuth, like);
router.delete('/:postId/like', requireAuth, unlike);
router.get('/:postId/likes', listLikers);

export default router;
