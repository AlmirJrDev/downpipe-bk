import { z } from 'zod';

/**
 * budget_spent, modifications_total e modifications_done propositalmente
 * NÃO fazem parte destes schemas: são campos derivados, recalculados pelo
 * backend via carAggregatesService sempre que uma etapa muda.
 */
const projectBaseSchema = {
  title: z.string().min(1, 'title é obrigatório').max(120),
  powerGoalFrom: z.number().int().min(0).max(5000).nullable().optional(),
  powerGoalTo: z.number().int().min(0).max(5000).nullable().optional(),
  budgetTotal: z.number().min(0).nullable().optional(),
};

export const createProjectSchema = z
  .object(projectBaseSchema)
  .strict()
  .refine(
    (data) =>
      data.powerGoalFrom == null || data.powerGoalTo == null || data.powerGoalFrom <= data.powerGoalTo,
    { message: 'powerGoalFrom deve ser menor ou igual a powerGoalTo', path: ['powerGoalFrom'] }
  );

export const updateProjectSchema = z
  .object({ ...projectBaseSchema, title: projectBaseSchema.title.optional() })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Envie ao menos um campo para atualizar',
  })
  .refine(
    (data) =>
      data.powerGoalFrom == null || data.powerGoalTo == null || data.powerGoalFrom <= data.powerGoalTo,
    { message: 'powerGoalFrom deve ser menor ou igual a powerGoalTo', path: ['powerGoalFrom'] }
  );

export const carIdParamSchema = z.object({
  carId: z.string().uuid('carId inválido'),
});

export const projectIdParamSchema = z.object({
  id: z.string().uuid('id inválido'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
