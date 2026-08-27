import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { parsePagination, buildPaginationMeta } from '@/shared/middleware/pagination.middleware';
import { savedPostsService } from './saved-posts.service';
import { postIdParamSchema } from './saved-posts.schema';

export async function save(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { postId } = postIdParamSchema.parse(req.params);
    const result = await savedPostsService.save(postId, req.user.id);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function unsave(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { postId } = postIdParamSchema.parse(req.params);
    const result = await savedPostsService.unsave(postId, req.user.id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function listSaved(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const pagination = parsePagination(req);
    const { posts, total } = await savedPostsService.listSaved(req.user.id, pagination);
    sendPaginated(res, posts, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}
