import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { searchService } from './search.service';
import { searchQuerySchema } from './search.schema';

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const { q } = searchQuerySchema.parse(req.query);
    const result = await searchService.search(q);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
