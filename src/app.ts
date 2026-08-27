import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from '@/config/env';
import { notFoundHandler, errorHandler } from '@/shared/middleware/error.middleware';
import authRoutes from '@/modules/auth/auth.routes';
import { meRouter, publicProfilesRouter } from '@/modules/profiles/profiles.routes';
import vehicleCatalogRoutes from '@/modules/vehicle-catalog/vehicle-catalog.routes';
import { carsRouter, profileCarsRouter } from '@/modules/cars/cars.routes';
import { carProjectRouter, projectsRouter } from '@/modules/projects/projects.routes';
import projectStepsRoutes from '@/modules/project-steps/project-steps.routes';
import { carModificationsRouter, modificationsRouter } from '@/modules/modifications/modifications.routes';
import { feedRouter, postsRouter, profilePostsRouter, carPostsRouter } from '@/modules/posts/posts.routes';
import likesRoutes from '@/modules/likes/likes.routes';
import { postSaveRouter, savedPostsRouter } from '@/modules/saved-posts/saved-posts.routes';
import { postCommentsRouter, commentsRouter } from '@/modules/comments/comments.routes';
import followsRoutes from '@/modules/follows/follows.routes';
import notificationsRoutes from '@/modules/notifications/notifications.routes';
import searchRoutes from '@/modules/search/search.routes';
import advertisementsRoutes from '@/modules/advertisements/advertisements.routes';
import statusRoutes from '@/modules/status/status.routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

  app.get('/health', (_req, res) => {
    res.json({ data: { status: 'ok' }, error: null });
  });

  // Fase 1
  app.use('/auth', authRoutes);
  app.use('/profile', meRouter);
  app.use('/profiles', publicProfilesRouter);

  // Fase 2
  app.use('/vehicles', vehicleCatalogRoutes);

  // Fase 3
  app.use('/cars', carsRouter);
  app.use('/profiles', profileCarsRouter);

  // Fase 4
  app.use('/cars', carProjectRouter);
  app.use('/projects', projectsRouter);
  app.use('/projects', projectStepsRoutes);
  app.use('/cars', carModificationsRouter);
  app.use('/modifications', modificationsRouter);

  // Fase 5
  app.use('/feed', feedRouter);
  app.use('/posts', postsRouter);
  app.use('/profiles', profilePostsRouter);
  app.use('/cars', carPostsRouter);

  // Fase 6
  app.use('/posts', likesRoutes);
  app.use('/posts', postCommentsRouter);
  app.use('/comments', commentsRouter);
  app.use('/profiles', followsRoutes);
  // Salvar post: privado, por isso a listagem vive em /profile (do próprio
  // usuário) e não em /profiles/:username.
  app.use('/posts', postSaveRouter);
  app.use('/profile', savedPostsRouter);

  // Fase 7
  app.use('/notifications', notificationsRoutes);
  app.use('/search', searchRoutes);

  // Fase 8
  app.use('/advertisements', advertisementsRoutes);

  // Página de status da sessão de testes (não faz parte da API do produto).
  app.use('/status', statusRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
