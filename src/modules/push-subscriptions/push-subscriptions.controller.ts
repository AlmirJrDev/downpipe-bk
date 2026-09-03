import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { env } from '@/config/env';
import { pushSubscriptionsRepository } from './push-subscriptions.repository';
import { subscribeSchema, unsubscribeSchema } from './push-subscriptions.schema';

/**
 * A chave pública em si não é segredo — é o "endereço" que o navegador usa
 * pra cifrar a inscrição, feita pra ser distribuída. Vem do servidor em vez
 * de embutida no bundle do app pra não precisar de rebuild toda vez que a
 * chave rodar; a privada nunca sai daqui.
 */
export async function vapidPublicKey(_req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, { publicKey: env.WEB_PUSH_VAPID_PUBLIC_KEY ?? null });
  } catch (err) {
    next(err);
  }
}

export async function subscribe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { endpoint, keys } = subscribeSchema.parse(req.body);
    await pushSubscriptionsRepository.upsert(req.user.id, endpoint, keys.p256dh, keys.auth);
    sendSuccess(res, null, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Sem checar dono: o endpoint em si já é o segredo (só quem tem a
 * inscrição sabe qual é), e "desinscrever um endpoint que não é seu" não
 * abre brecha nenhuma — na pior hipótese, para de notificar um aparelho
 * que não era do atacante de qualquer forma.
 */
export async function unsubscribe(req: Request, res: Response, next: NextFunction) {
  try {
    const { endpoint } = unsubscribeSchema.parse(req.body);
    await pushSubscriptionsRepository.deleteByEndpoint(endpoint);
    sendSuccess(res, null);
  } catch (err) {
    next(err);
  }
}
