import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { moderationService } from './moderation.service';
import { createReportSchema, userIdParamSchema } from './moderation.schema';

export async function createReport(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = createReportSchema.parse(req.body);
    const result = await moderationService.report(req.user.id, input);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function block(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { userId } = userIdParamSchema.parse(req.params);
    const result = await moderationService.block(req.user.id, userId);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function unblock(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { userId } = userIdParamSchema.parse(req.params);
    const result = await moderationService.unblock(req.user.id, userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function listBlocked(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const result = await moderationService.listBlocked(req.user.id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
