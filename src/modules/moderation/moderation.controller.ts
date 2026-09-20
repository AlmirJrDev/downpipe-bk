import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { moderationService } from './moderation.service';
import { createReportSchema, userIdParamSchema, filaQuerySchema, reportIdParamSchema, alvoParamsSchema } from './moderation.schema';

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

/** A fila de denúncias, pra quem modera. */
export async function listReports(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = filaQuerySchema.parse(req.query);
    sendSuccess(res, await moderationService.fila(status));
  } catch (err) {
    next(err);
  }
}

/** Quantas estão abertas — o número na entrada da moderação. */
export async function countReports(_req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await moderationService.pendentes());
  } catch (err) {
    next(err);
  }
}

export async function reviewReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = reportIdParamSchema.parse(req.params);
    sendSuccess(res, await moderationService.revisar(id));
  } catch (err) {
    next(err);
  }
}

export async function removeTarget(req: Request, res: Response, next: NextFunction) {
  try {
    const { tipo, id } = alvoParamsSchema.parse(req.params);
    sendSuccess(res, await moderationService.apagarConteudo(tipo, id));
  } catch (err) {
    next(err);
  }
}
