import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { eventSuggestionsService } from './event-suggestions.service';
import {
  approveSuggestionSchema,
  createSuggestionSchema,
  listSuggestionsQuerySchema,
  suggestionIdParamSchema,
} from './event-suggestions.schema';

/** POST /events/suggestions — "vi um rolê, olha aí". */
export async function suggest(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = createSuggestionSchema.parse(req.body);
    sendSuccess(res, await eventSuggestionsService.sugerir(input, req.user.id), 201);
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = listSuggestionsQuerySchema.parse(req.query);
    sendSuccess(res, await eventSuggestionsService.fila(status));
  } catch (err) {
    next(err);
  }
}

export async function count(_req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await eventSuggestionsService.pendentes());
  } catch (err) {
    next(err);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = suggestionIdParamSchema.parse(req.params);
    const correcoes = approveSuggestionSchema.parse(req.body);
    sendSuccess(res, await eventSuggestionsService.aprovar(id, req.user.id, correcoes), 201);
  } catch (err) {
    next(err);
  }
}

/** POST /admin/suggestions/:id/photo — puxa a arte do post da fonte. */
export async function photo(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = suggestionIdParamSchema.parse(req.params);
    sendSuccess(res, await eventSuggestionsService.puxarFoto(id, req.user.id));
  } catch (err) {
    next(err);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = suggestionIdParamSchema.parse(req.params);
    sendSuccess(res, await eventSuggestionsService.descartar(id, req.user.id));
  } catch (err) {
    next(err);
  }
}
