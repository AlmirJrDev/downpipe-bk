import { z } from 'zod';

export const createCommentSchema = z.object({
  text: z.string().min(1, 'text é obrigatório').max(1000),
});

export const updateCommentSchema = z.object({
  text: z.string().min(1, 'text é obrigatório').max(1000),
});

export const postIdParamSchema = z.object({
  postId: z.string().uuid('postId inválido'),
});

export const commentIdParamSchema = z.object({
  id: z.string().uuid('id inválido'),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
