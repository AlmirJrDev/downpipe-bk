import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { eventChatService } from './event-chat.service';
import {
  eventIdParamSchema,
  listMessagesQuerySchema,
  messageIdParamSchema,
  sendMessageSchema,
} from './event-chat.schema';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { eventId } = eventIdParamSchema.parse(req.params);
    const janela = listMessagesQuerySchema.parse(req.query);
    sendSuccess(res, await eventChatService.list(eventId, req.user.id, janela));
  } catch (err) {
    next(err);
  }
}

export async function send(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { eventId } = eventIdParamSchema.parse(req.params);
    const { text } = sendMessageSchema.parse(req.body);
    sendSuccess(res, await eventChatService.send(eventId, req.user.id, text), 201);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { messageId } = messageIdParamSchema.parse(req.params);
    await eventChatService.remove(messageId, req.user.id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function unread(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { eventId } = eventIdParamSchema.parse(req.params);
    sendSuccess(res, { unread: await eventChatService.unread(eventId, req.user.id) });
  } catch (err) {
    next(err);
  }
}
