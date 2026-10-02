import { z } from 'zod';

/**
 * O código do ingresso: maiúsculo, sem ponto (o ponto separa as partes do
 * QR no app). Aceita tanto o alfabeto novo quanto o hexadecimal dos
 * ingressos criados pela migration 0038.
 */
export const ticketCodeSchema = z.string().regex(/^[0-9A-Z]{6,20}$/, 'código de ingresso inválido');

/**
 * Lote de entradas que a portaria registrou, possivelmente sem internet.
 *
 * O teto é generoso de propósito: uma portaria que passou a noite offline
 * manda tudo de uma vez quando o sinal volta, e recusar o lote por tamanho
 * perderia justamente as entradas que mais importam.
 */
export const syncCheckinsSchema = z.object({
  checkins: z
    .array(
      z.object({
        code: ticketCodeSchema,
        at: z.string().datetime({ offset: true, message: 'at precisa ser ISO 8601' }),
        deviceId: z.string().min(1).max(40),
      })
    )
    .max(5000),
});

export type SyncCheckinsInput = z.infer<typeof syncCheckinsSchema>;
