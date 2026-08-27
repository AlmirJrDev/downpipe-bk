import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { listByCar, create, update, remove } from './modifications.controller';

// Rotas em /cars/:carId/modifications
export const carModificationsRouter = Router();
carModificationsRouter.get('/:carId/modifications', listByCar);
carModificationsRouter.post('/:carId/modifications', requireAuth, create);

// Rotas em /modifications/:id
export const modificationsRouter = Router();
modificationsRouter.patch('/:id', requireAuth, update);
modificationsRouter.delete('/:id', requireAuth, remove);
