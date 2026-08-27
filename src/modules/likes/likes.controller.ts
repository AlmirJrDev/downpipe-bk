import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { parsePagination, buildPaginationMeta } from '@/shared/middleware/pagination.middleware';
import { likesService } from './likes.service';
import { postIdParamSchema } from './likes.schema';

export async function like(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { postId } = postIdParamSchema.parse(req.params);
    const result = await likesService.like(postId, req.user.id);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function unlike(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { postId } = postIdParamSchema.parse(req.params);
    const result = await likesService.unlike(postId, req.user.id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function listLikers(req: Request, res: Response, next: NextFunction) {
  try {
    const { postId } = postIdParamSchema.parse(req.params);
    const pagination = parsePagination(req);
    const { likers, total } = await likesService.listLikers(postId, pagination);
    sendPaginated(res, likers, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}
