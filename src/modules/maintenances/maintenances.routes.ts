import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { listByCar, create, update, remove } from './maintenances.controller';

/**
 * Rotas em /cars/:carId/maintenances.
 *
 * Tudo exige login, inclusive a listagem: diferente das modificações, o
 * histórico de manutenção só o dono vê.
 */
export const carMaintenancesRouter = Router();
carMaintenancesRouter.get('/:carId/maintenances', requireAuth, listByCar);
carMaintenancesRouter.post('/:carId/maintenances', requireAuth, create);

/** Rotas em /maintenances/:id */
export const maintenancesRouter = Router();
maintenancesRouter.patch('/:id', requireAuth, update);
maintenancesRouter.delete('/:id', requireAuth, remove);
