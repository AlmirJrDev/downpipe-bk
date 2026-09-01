import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { geocodingService } from '@/shared/geocoding/geocoding.service';

const querySchema = z.object({
  q: z.string().min(3, 'Digite ao menos 3 caracteres').max(200),
});

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const { q } = querySchema.parse(req.query);
    const suggestions = await geocodingService.search(q);
    sendSuccess(res, suggestions);
  } catch (err) {
    next(err);
  }
}
