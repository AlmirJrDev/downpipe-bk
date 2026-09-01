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
  'outro',
]);

export const createReportSchema = z
  .object({
    postId: z.string().uuid('postId inválido').optional(),
    commentId: z.string().uuid('commentId inválido').optional(),
    profileId: z.string().uuid('profileId inválido').optional(),
    reason: reportReasonEnum,
    details: z.string().max(600, 'Detalhe muito longo').optional(),
  })
  .strict()
  .refine(
    (d) => [d.postId, d.commentId, d.profileId].filter(Boolean).length === 1,
    { message: 'Informe exatamente um alvo: postId, commentId ou profileId' }
  );

export const userIdParamSchema = z.object({
  userId: z.string().uuid('userId inválido'),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ReportReason = z.infer<typeof reportReasonEnum>;
