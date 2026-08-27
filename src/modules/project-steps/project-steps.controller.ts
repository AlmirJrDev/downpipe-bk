import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { projectStepsService } from './project-steps.service';
import {
  createStepSchema,
  updateStepSchema,
  projectIdParamSchema,
  stepIdParamSchema,
} from './project-steps.schema';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const steps = await projectStepsService.list(projectId);
    sendSuccess(res, steps);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { projectId } = projectIdParamSchema.parse(req.params);
    const input = createStepSchema.parse(req.body);
    const step = await projectStepsService.create(projectId, req.user.id, input);
    sendSuccess(res, step, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { projectId, stepId } = stepIdParamSchema.parse(req.params);
    const input = updateStepSchema.parse(req.body);
    const step = await projectStepsService.update(projectId, stepId, req.user.id, input);
    sendSuccess(res, step);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { projectId, stepId } = stepIdParamSchema.parse(req.params);
    await projectStepsService.remove(projectId, stepId, req.user.id);
    sendSuccess(res, { success: true });
  } catch (err) {
    next(err);
  }
}
