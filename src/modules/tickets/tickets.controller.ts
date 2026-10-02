import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { eventIdAttendParamSchema } from '@/modules/events/events.schema';
import { ticketsService } from './tickets.service';
import { syncCheckinsSchema } from './tickets.schema';

export async function getMyTicket(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { eventId } = eventIdAttendParamSchema.parse(req.params);
    sendSuccess(res, await ticketsService.getMine(eventId, req.user.id));
  } catch (err) {
    next(err);
  }
}

export async function getCheckinList(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { eventId } = eventIdAttendParamSchema.parse(req.params);
    sendSuccess(res, await ticketsService.getCheckinList(eventId, req.user.id));
  } catch (err) {
    next(err);
  }
}

export async function syncCheckins(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { eventId } = eventIdAttendParamSchema.parse(req.params);
    const input = syncCheckinsSchema.parse(req.body);
    sendSuccess(res, await ticketsService.sync(eventId, req.user.id, input));
  } catch (err) {
    next(err);
  }
}
