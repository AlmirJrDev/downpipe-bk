import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { carIdParamSchema } from '@/modules/modifications/modifications.schema';
import { maintenancesService } from './maintenances.service';
import {
  createMaintenanceSchema,
  updateMaintenanceSchema,
  maintenanceIdParamSchema,
} from './maintenances.schema';

export async function listByCar(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { carId } = carIdParamSchema.parse(req.params);
    sendSuccess(res, await maintenancesService.listByCar(carId, req.user.id));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { carId } = carIdParamSchema.parse(req.params);
    const input = createMaintenanceSchema.parse(req.body);
    sendSuccess(res, await maintenancesService.create(carId, req.user.id, input), 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = maintenanceIdParamSchema.parse(req.params);
    const input = updateMaintenanceSchema.parse(req.body);
    sendSuccess(res, await maintenancesService.update(id, req.user.id, input));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = maintenanceIdParamSchema.parse(req.params);
    sendSuccess(res, await maintenancesService.remove(id, req.user.id));
  } catch (err) {
    next(err);
  }
}
