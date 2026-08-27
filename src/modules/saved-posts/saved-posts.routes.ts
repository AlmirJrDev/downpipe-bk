import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { save, unsave, listSaved } from './saved-posts.controller';

// Rotas em /posts/:postId/save
export const postSaveRouter = Router();
postSaveRouter.post('/:postId/save', requireAuth, save);
postSaveRouter.delete('/:postId/save', requireAuth, unsave);

// Rota em /profile/me/saved — a lista é privada, sempre do próprio usuário.
export const savedPostsRouter = Router();
savedPostsRouter.get('/me/saved', requireAuth, listSaved);
