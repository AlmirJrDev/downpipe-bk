import { z } from 'zod';

/**
 * O formato exato que PushSubscription.toJSON() devolve no navegador — o
 * app manda isso sem transformar nada, então o schema espelha o objeto de
 * verdade em vez de inventar um formato próprio.
 */
export const subscribeSchema = z.object({
  endpoint: z.string().url('endpoint deve ser uma URL válida'),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh é obrigatório'),
    auth: z.string().min(1, 'auth é obrigatório'),
  }),
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().url('endpoint deve ser uma URL válida'),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;
