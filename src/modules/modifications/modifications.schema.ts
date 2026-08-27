import { z } from 'zod';

export const modificationCategoryEnum = z.enum([
  'Performance',
  'Suspensão',
  'Estética',
  'Eletrônica',
  'Motor',
  'Freios',
  'Interior',
  'Escape',
  'Rodas',
  'Other',
]);

const modificationBaseSchema = {
  name: z.string().min(1, 'name é obrigatório').max(120),
  category: modificationCategoryEnum.nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
  date: z.string().date('date deve estar no formato YYYY-MM-DD').nullable().optional(),
  icon: z.string().max(60).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
};

export const createModificationSchema = z.object(modificationBaseSchema).strict();

export const updateModificationSchema = z
  .object({ ...modificationBaseSchema, name: modificationBaseSchema.name.optional() })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Envie ao menos um campo para atualizar',
  });

export const carIdParamSchema = z.object({
  carId: z.string().uuid('carId inválido'),
});

export const modificationIdParamSchema = z.object({
  id: z.string().uuid('id inválido'),
});

export type CreateModificationInput = z.infer<typeof createModificationSchema>;
export type UpdateModificationInput = z.infer<typeof updateModificationSchema>;
