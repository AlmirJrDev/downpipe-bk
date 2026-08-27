import { z } from 'zod';

export const stepStatusEnum = z.enum(['pending', 'active', 'done']);

const stepBaseSchema = {
  name: z.string().min(1, 'name é obrigatório').max(120),
  status: stepStatusEnum.optional(),
  estimatedCost: z.number().min(0).nullable().optional(),
  actualCost: z.number().min(0).nullable().optional(),
  date: z.string().date('date deve estar no formato YYYY-MM-DD').nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  position: z.number().int().min(0).nullable().optional(),
};

export const createStepSchema = z.object(stepBaseSchema).strict();

export const updateStepSchema = z
  .object({ ...stepBaseSchema, name: stepBaseSchema.name.optional() })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Envie ao menos um campo para atualizar',
  });

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid('projectId inválido'),
});

export const stepIdParamSchema = z.object({
  projectId: z.string().uuid('projectId inválido'),
  stepId: z.string().uuid('stepId inválido'),
});

export type CreateStepInput = z.infer<typeof createStepSchema>;
export type UpdateStepInput = z.infer<typeof updateStepSchema>;
