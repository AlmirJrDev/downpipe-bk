import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { geocodingService } from '@/shared/geocoding/geocoding.service';

const querySchema = z.object({
  q: z.string().min(3, 'Digite ao menos 3 caracteres').max(200),
});

// Vêm da query string, então chegam como texto: coerce antes de validar.
const reverseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
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

/** Ponto no mapa -> endereço e cidade, para preencher o formulário. */
export async function reverse(req: Request, res: Response, next: NextFunction) {
  try {
    const { lat, lng } = reverseSchema.parse(req.query);
    const endereco = await geocodingService.reverse(lat, lng);
    // null é resposta legítima: o ponto pode cair no meio do nada, e aí a
    // pessoa preenche na mão. Não é 404 — a requisição funcionou.
    sendSuccess(res, endereco);
  } catch (err) {
    next(err);
  }
}
