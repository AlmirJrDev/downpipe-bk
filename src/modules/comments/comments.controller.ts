import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { parsePagination, buildPaginationMeta } from '@/shared/middleware/pagination.middleware';
import { commentsService } from './comments.service';
import {
  createCommentSchema,
  updateCommentSchema,
  postIdParamSchema,
  commentIdParamSchema,
} from './comments.schema';

export async function listByPost(req: Request, res: Response, next: NextFunction) {
  try {
    const { postId } = postIdParamSchema.parse(req.params);
    const pagination = parsePagination(req);
    const { comments, total } = await commentsService.listByPost(postId, pagination);
    sendPaginated(res, comments, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { postId } = postIdParamSchema.parse(req.params);
    const { text } = createCommentSchema.parse(req.body);
    const comment = await commentsService.create(postId, req.user.id, text);
    sendSuccess(res, comment, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = commentIdParamSchema.parse(req.params);
    const { text } = updateCommentSchema.parse(req.body);
    const comment = await commentsService.update(id, req.user.id, text);
    sendSuccess(res, comment);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = commentIdParamSchema.parse(req.params);
    await commentsService.remove(id, req.user.id);
    sendSuccess(res, { success: true });
  } catch (err) {
    next(err);
  }
}
