import { Router } from 'express';
import { requireAuth, attachUserIfPresent } from '@/shared/middleware/auth.middleware';
import { imagesUpload } from '@/shared/middleware/upload.middleware';
import {
  getFeed,
  getById,
  listByUsername,
  listByCar,
  listByEvent,
  respondCarTag,
  create,
  update,
  remove,
} from './posts.controller';

// Rota em /feed
export const feedRouter = Router();
feedRouter.get('/', attachUserIfPresent, getFeed);

// Rotas em /posts
export const postsRouter = Router();
postsRouter.get('/:id', attachUserIfPresent, getById);
postsRouter.post('/', requireAuth, imagesUpload, create);
postsRouter.patch('/:id', requireAuth, update);
postsRouter.delete('/:id', requireAuth, remove);
// Responder à marcação do seu carro numa foto de outra pessoa.
postsRouter.patch('/:id/car-tag', requireAuth, respondCarTag);

// Rota em /profiles/:username/posts
export const profilePostsRouter = Router();
profilePostsRouter.get('/:username/posts', attachUserIfPresent, listByUsername);

// Rota em /cars/:carId/posts
export const carPostsRouter = Router();
carPostsRouter.get('/:carId/posts', attachUserIfPresent, listByCar);

// Rota em /events/:eventId/posts — o que o pessoal registrou no rolê.
export const eventPostsRouter = Router();
eventPostsRouter.get('/:eventId/posts', attachUserIfPresent, listByEvent);
