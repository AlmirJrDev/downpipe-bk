import { z } from 'zod';

/**
 * Motivos fechados, e não texto livre.
 *
 * Quem denuncia quer resolver em dois toques, não escrever uma redação — e
 * uma fila de motivos categorizados é a única que dá pra priorizar depois.
 * O campo livre existe como complemento, nunca como o dado principal.
 */
export const reportReasonEnum = z.enum([
  'spam',
  'conteudo_improprio',
  'assedio',
  'carro_nao_e_meu',
  'informacao_falsa',
  /**
   * Só faz sentido em rolê: a pessoa foi até lá e não tinha nada.
   *
   * É o motivo mais caro do app — quem dirigiu 60 km à toa não volta a
   * confiar no calendário —, e separado de 'informacao_falsa' porque a ação
   * é outra: data errada se corrige, rolê que não existe sai do ar.
   */
  'role_nao_aconteceu',
  'outro',
]);

export const createReportSchema = z
  .object({
    postId: z.string().uuid('postId inválido').optional(),
    commentId: z.string().uuid('commentId inválido').optional(),
    profileId: z.string().uuid('profileId inválido').optional(),
    /** Mensagem do chat de um rolê. */
    messageId: z.string().uuid('messageId inválido').optional(),
    /** O rolê em si: não aconteceu, mudou de lugar, é golpe. */
    eventId: z.string().uuid('eventId inválido').optional(),
    reason: reportReasonEnum,
    details: z.string().max(600, 'Detalhe muito longo').optional(),
  })
  .strict()
  .refine(
    (d) =>
      [d.postId, d.commentId, d.profileId, d.messageId, d.eventId].filter(Boolean).length === 1,
    {
      message:
        'Informe exatamente um alvo: postId, commentId, profileId, messageId ou eventId',
    }
  );

/** A fila abre nas pendentes; as revisadas servem de histórico. */
export const filaQuerySchema = z.object({
  status: z.enum(['open', 'reviewed']).default('open'),
});

export const reportIdParamSchema = z.object({
  id: z.string().uuid('id inválido'),
});

export const alvoParamsSchema = z.object({
  tipo: z.enum(['post', 'comentario', 'mensagem', 'evento']),
  id: z.string().uuid('id inválido'),
});

export const userIdParamSchema = z.object({
  userId: z.string().uuid('userId inválido'),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ReportReason = z.infer<typeof reportReasonEnum>;
