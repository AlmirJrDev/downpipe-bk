import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { parsePagination, buildPaginationMeta } from '@/shared/middleware/pagination.middleware';
import { eventsService } from './events.service';
import {
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
  eventIdParamSchema,
  eventIdAttendParamSchema,
  attendBodySchema,
  attendanceCarSchema,
} from './events.schema';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = listEventsQuerySchema.parse(req.query);
    const pagination = parsePagination(req);
    const { events, total } = await eventsService.list(filters, pagination, req.user?.id);
    sendPaginated(res, events, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}

export async function listByOrganizer(req: Request, res: Response, next: NextFunction) {
  try {
    const { username } = req.params as { username: string };
    const pagination = parsePagination(req);
    const { events, total } = await eventsService.listByOrganizer(
      username,
      pagination,
      req.user?.id
    );
    sendPaginated(res, events, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = eventIdParamSchema.parse(req.params);
    const event = await eventsService.getById(id, req.user?.id);
    sendSuccess(res, event);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = createEventSchema.parse(req.body);
    const event = await eventsService.create(req.user.id, input);
    sendSuccess(res, event, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = eventIdParamSchema.parse(req.params);
    const input = updateEventSchema.parse(req.body);
    const event = await eventsService.update(id, req.user.id, input);
    sendSuccess(res, event);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = eventIdParamSchema.parse(req.params);
    await eventsService.remove(id, req.user.id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function uploadPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    if (!req.file) throw AppError.validation('Envie uma imagem no campo "file"');
    const { id } = eventIdParamSchema.parse(req.params);
    const event = await eventsService.uploadPhoto(
      id,
      req.user.id,
      req.file.buffer,
      req.file.mimetype
    );
    sendSuccess(res, event);
  } catch (err) {
    next(err);
  }
}

export async function attend(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { eventId } = eventIdAttendParamSchema.parse(req.params);
    // Corpo opcional: confirmar presença sem dizer o carro é o caso comum.
    const { carId } = attendBodySchema.parse(req.body ?? {});
    const result = await eventsService.attend(eventId, req.user.id, carId);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function unattend(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { eventId } = eventIdAttendParamSchema.parse(req.params);
    const result = await eventsService.unattend(eventId, req.user.id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function listAttendees(req: Request, res: Response, next: NextFunction) {
  try {
    const { eventId } = eventIdAttendParamSchema.parse(req.params);
    const pagination = parsePagination(req);
    const { attendees, total } = await eventsService.listAttendees(eventId, pagination);
    sendPaginated(res, attendees, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}

/** Trocar (ou tirar) o carro que vai levar, depois de já ter confirmado. */
export async function updateAttendanceCar(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { eventId } = eventIdAttendParamSchema.parse(req.params);
    const { carId } = attendanceCarSchema.parse(req.body);
    const result = await eventsService.updateAttendanceCar(eventId, req.user.id, carId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
