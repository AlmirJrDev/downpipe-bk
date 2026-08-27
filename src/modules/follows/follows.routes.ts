import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { follow, unfollow, listFollowers, listFollowing } from './follows.controller';

// Rotas em /profiles/:userId/follow(ers|ing)
const router = Router();

router.post('/:userId/follow', requireAuth, follow);
router.delete('/:userId/follow', requireAuth, unfollow);
router.get('/:userId/followers', listFollowers);
router.get('/:userId/following', listFollowing);

export default router;
