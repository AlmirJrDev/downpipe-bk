import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { parsePagination, buildPaginationMeta } from '@/shared/middleware/pagination.middleware';
import { followsService } from './follows.service';
import { userIdParamSchema } from './follows.schema';

export async function follow(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { userId } = userIdParamSchema.parse(req.params);
    const result = await followsService.follow(req.user.id, userId);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function unfollow(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { userId } = userIdParamSchema.parse(req.params);
    const result = await followsService.unfollow(req.user.id, userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function listFollowers(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const pagination = parsePagination(req);
    const { followers, total } = await followsService.listFollowers(userId, pagination);
    sendPaginated(res, followers, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}

export async function listFollowing(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const pagination = parsePagination(req);
    const { following, total } = await followsService.listFollowing(userId, pagination);
    sendPaginated(res, following, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}
