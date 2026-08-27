import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { parsePagination, buildPaginationMeta } from '@/shared/middleware/pagination.middleware';
import { notificationsService } from './notifications.service';
import { notificationIdParamSchema, listNotificationsQuerySchema } from './notifications.schema';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { unreadOnly } = listNotificationsQuerySchema.parse(req.query);
    const pagination = parsePagination(req);

    const { notifications, total } = await notificationsService.list(
      req.user.id,
      unreadOnly ?? false,
      pagination
    );

    sendPaginated(res, notifications, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const count = await notificationsService.countUnread(req.user.id);
    sendSuccess(res, { unreadCount: count });
  } catch (err) {
    next(err);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = notificationIdParamSchema.parse(req.params);
    await notificationsService.markRead(id, req.user.id);
    sendSuccess(res, { success: true });
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    await notificationsService.markAllRead(req.user.id);
    sendSuccess(res, { success: true });
  } catch (err) {
    next(err);
  }
}
