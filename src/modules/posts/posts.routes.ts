import { Router } from 'express';
import { requireAuth, attachUserIfPresent } from '@/shared/middleware/auth.middleware';
import { imagesUpload } from '@/shared/middleware/upload.middleware';
import { getFeed, getById, listByUsername, listByCar, create, update, remove } from './posts.controller';

// Rota em /feed
export const feedRouter = Router();
feedRouter.get('/', attachUserIfPresent, getFeed);

// Rotas em /posts
export const postsRouter = Router();
postsRouter.get('/:id', attachUserIfPresent, getById);
postsRouter.post('/', requireAuth, imagesUpload, create);
postsRouter.patch('/:id', requireAuth, update);
postsRouter.delete('/:id', requireAuth, remove);

// Rota em /profiles/:username/posts
export const profilePostsRouter = Router();
profilePostsRouter.get('/:username/posts', attachUserIfPresent, listByUsername);

// Rota em /cars/:carId/posts
export const carPostsRouter = Router();
carPostsRouter.get('/:carId/posts', attachUserIfPresent, listByCar);
