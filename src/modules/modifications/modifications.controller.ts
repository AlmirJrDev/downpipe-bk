import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { modificationsService } from './modifications.service';
import {
  createModificationSchema,
  updateModificationSchema,
  carIdParamSchema,
  modificationIdParamSchema,
} from './modifications.schema';

export async function listByCar(req: Request, res: Response, next: NextFunction) {
  try {
    const { carId } = carIdParamSchema.parse(req.params);
    const modifications = await modificationsService.listByCar(carId);
    sendSuccess(res, modifications);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { carId } = carIdParamSchema.parse(req.params);
    const input = createModificationSchema.parse(req.body);
    const modification = await modificationsService.create(carId, req.user.id, input);
    sendSuccess(res, modification, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = modificationIdParamSchema.parse(req.params);
    const input = updateModificationSchema.parse(req.body);
    const modification = await modificationsService.update(id, req.user.id, input);
    sendSuccess(res, modification);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = modificationIdParamSchema.parse(req.params);
    await modificationsService.remove(id, req.user.id);
    sendSuccess(res, { success: true });
  } catch (err) {
    next(err);
  }
}
