import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { list, getUnreadCount, markRead, markAllRead } from './notifications.controller';

const router = Router();

router.get('/', requireAuth, list);
router.get('/unread-count', requireAuth, getUnreadCount);
router.patch('/read-all', requireAuth, markAllRead);
router.patch('/:id/read', requireAuth, markRead);

export default router;
