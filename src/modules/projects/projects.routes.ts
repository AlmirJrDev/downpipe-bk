import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { getByCarId, create, update, remove } from './projects.controller';

// Rotas em /cars/:carId/project
export const carProjectRouter = Router();
carProjectRouter.get('/:carId/project', getByCarId);
carProjectRouter.post('/:carId/project', requireAuth, create);

// Rotas em /projects/:id
export const projectsRouter = Router();
projectsRouter.patch('/:id', requireAuth, update);
projectsRouter.delete('/:id', requireAuth, remove);
