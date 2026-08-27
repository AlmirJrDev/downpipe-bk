import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { imageUpload } from '@/shared/middleware/upload.middleware';
import { list, listByUsername, getById, create, update, remove, uploadPhoto, getStatistics } from './cars.controller';

// Rotas em /cars
export const carsRouter = Router();

carsRouter.get('/', list);
carsRouter.get('/:id', getById);
carsRouter.get('/:id/statistics', getStatistics);
carsRouter.post('/', requireAuth, create);
carsRouter.patch('/:id', requireAuth, update);
carsRouter.delete('/:id', requireAuth, remove);
carsRouter.post('/:id/photo', requireAuth, imageUpload, uploadPhoto);

// Rota em /profiles/:username/cars (montada separadamente em app.ts)
export const profileCarsRouter = Router();
profileCarsRouter.get('/:username/cars', listByUsername);
