import { z } from 'zod';

export const eventIdParamSchema = z.object({
  eventId: z.string().uuid('eventId inválido'),
});

export const messageIdParamSchema = z.object({
  messageId: z.string().uuid('messageId inválido'),
});

export const sendMessageSchema = z
  .object({
    // O trim vem antes do limite: mensagem só de espaços não passa.
    text: z.string().trim().min(1, 'Escreva alguma coisa').max(1000, 'Mensagem muito longa'),
  })
  .strict();

/**
 * Janela de mensagens. As datas voltam como a API mandou (com microssegundos
 * e fuso), então só é conferido que é uma data válida.
 */
export const listMessagesQuerySchema = z
  .object({
    desde: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'desde inválido').optional(),
    antes: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'antes inválido').optional(),
    /** O `agora` da conferida anterior: devolve o que foi apagado desde então. */
    removidasDesde: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), 'removidasDesde inválido')
      .optional(),
  })
  .refine((q) => !(q.desde && q.antes), { message: 'Use desde ou antes, não os dois' });
