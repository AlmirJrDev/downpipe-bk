import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { listByPost, create, update, remove } from './comments.controller';

// Rotas em /posts/:postId/comments
export const postCommentsRouter = Router();
postCommentsRouter.get('/:postId/comments', listByPost);
postCommentsRouter.post('/:postId/comments', requireAuth, create);

// Rotas em /comments/:id
export const commentsRouter = Router();
commentsRouter.patch('/:id', requireAuth, update);
commentsRouter.delete('/:id', requireAuth, remove);
