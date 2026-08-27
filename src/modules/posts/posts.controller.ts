import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { parsePagination, buildPaginationMeta } from '@/shared/middleware/pagination.middleware';
import { usernameParamSchema } from '@/modules/profiles/profiles.schema';
import { postsService } from './posts.service';
import { createPostSchema, updatePostSchema, postIdParamSchema, carIdParamSchema } from './posts.schema';

export async function getFeed(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req);
    const { posts, total } = await postsService.getFeed(pagination, req.user?.id);
    sendPaginated(res, posts, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = postIdParamSchema.parse(req.params);
    const post = await postsService.getById(id, req.user?.id);
    sendSuccess(res, post);
  } catch (err) {
    next(err);
  }
}

export async function listByUsername(req: Request, res: Response, next: NextFunction) {
  try {
    const { username } = usernameParamSchema.parse(req.params);
    const pagination = parsePagination(req);
    const { posts, total } = await postsService.listByUsername(username, pagination, req.user?.id);
    sendPaginated(res, posts, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}

export async function listByCar(req: Request, res: Response, next: NextFunction) {
  try {
    const { carId } = carIdParamSchema.parse(req.params);
    const pagination = parsePagination(req);
    const { posts, total } = await postsService.listByCar(carId, pagination, req.user?.id);
    sendPaginated(res, posts, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = createPostSchema.parse(req.body);
    const files = ((req.files as Express.Multer.File[] | undefined) ?? []).map((file) => ({
      buffer: file.buffer,
      mimetype: file.mimetype,
    }));

    const post = await postsService.create(req.user.id, input, files);
    sendSuccess(res, post, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = postIdParamSchema.parse(req.params);
    const input = updatePostSchema.parse(req.body);
    const post = await postsService.update(id, req.user.id, input);
    sendSuccess(res, post);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = postIdParamSchema.parse(req.params);
    await postsService.remove(id, req.user.id);
    sendSuccess(res, { success: true });
  } catch (err) {
    next(err);
  }
}
