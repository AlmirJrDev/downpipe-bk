import { z } from 'zod';

export const carStatusEnum = z.enum(['planning', 'building', 'complete']);

export const carCategoryEnum = z.enum([
  'JDM',
  'Euro',
  'Muscle',
  'Performance',
  'Clássicos',
  'Stance',
  'Other',
]);

/**
 * Campos aceitos na criação/edição de um carro. Note que `project_progress`
 * e `amount_invested` propositalmente NÃO fazem parte deste schema: são
 * derivados/recalculados pelo backend (a partir da Fase 4), nunca aceitos
 * diretamente do frontend.
 */
const carBaseSchema = {
  vehicleVersionId: z.string().uuid('vehicleVersionId inválido').nullable().optional(),
  version: z.string().max(120).nullable().optional(),
  engine: z.string().max(120).nullable().optional(),
  power: z.number().int().min(0).max(5000).nullable().optional(),
  torque: z.number().int().min(0).max(10000).nullable().optional(),
  transmission: z.string().max(60).nullable().optional(),
  drivetrain: z.string().max(60).nullable().optional(),
  mileage: z.number().int().min(0).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  status: carStatusEnum.optional(),
  category: carCategoryEnum.nullable().optional(),
};

export const createCarSchema = z.object(carBaseSchema).strict();

export const updateCarSchema = z
  .object(carBaseSchema)
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Envie ao menos um campo para atualizar',
  });

export const carIdParamSchema = z.object({
  id: z.string().uuid('id inválido'),
});

export const listCarsQuerySchema = z.object({
  category: carCategoryEnum.optional(),
  status: carStatusEnum.optional(),
});

export type CreateCarInput = z.infer<typeof createCarSchema>;
export type UpdateCarInput = z.infer<typeof updateCarSchema>;
export type ListCarsQuery = z.infer<typeof listCarsQuerySchema>;
