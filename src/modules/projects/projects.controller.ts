import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { projectsService } from './projects.service';
import {
  createProjectSchema,
  updateProjectSchema,
  carIdParamSchema,
  projectIdParamSchema,
} from './projects.schema';

export async function getByCarId(req: Request, res: Response, next: NextFunction) {
  try {
    const { carId } = carIdParamSchema.parse(req.params);
    const project = await projectsService.getByCarId(carId);
    sendSuccess(res, project);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { carId } = carIdParamSchema.parse(req.params);
    const input = createProjectSchema.parse(req.body);
    const project = await projectsService.create(carId, req.user.id, input);
    sendSuccess(res, project, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = projectIdParamSchema.parse(req.params);
    const input = updateProjectSchema.parse(req.body);
    const project = await projectsService.update(id, req.user.id, input);
    sendSuccess(res, project);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = projectIdParamSchema.parse(req.params);
    await projectsService.remove(id, req.user.id);
    sendSuccess(res, { success: true });
  } catch (err) {
    next(err);
  }
}
