import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { advertisementsService } from './advertisements.service';
import { listActiveAdsQuerySchema } from './advertisements.schema';

export async function listActive(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit } = listActiveAdsQuerySchema.parse(req.query);
    const ads = await advertisementsService.listActive(limit);
    sendSuccess(res, ads);
  } catch (err) {
    next(err);
  }
}
