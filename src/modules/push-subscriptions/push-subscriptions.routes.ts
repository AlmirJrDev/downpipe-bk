import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { subscribe, unsubscribe, vapidPublicKey } from './push-subscriptions.controller';

// Rotas em /push
export const pushSubscriptionsRouter = Router();
// Pública: é só a chave pública, não expõe nada de ninguém.
pushSubscriptionsRouter.get('/vapid-public-key', vapidPublicKey);
pushSubscriptionsRouter.post('/subscribe', requireAuth, subscribe);
pushSubscriptionsRouter.post('/unsubscribe', requireAuth, unsubscribe);
