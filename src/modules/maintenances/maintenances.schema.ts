import { z } from 'zod';

/**
 * Manutenção é texto livre com sugestões no app, e não enum fechado: cada
 * carro tem a mania dele ("regulagem de válvula", "sangria de freio"), e uma
 * lista fechada no banco viraria migration toda semana.
 */
const maintenanceBaseSchema = {
  kind: z.string().min(1, 'Diga o que foi feito').max(60),
  doneAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'doneAt deve ser uma data no formato AAAA-MM-DD'),
  odometer: z.number().int().min(0).max(2_000_000).nullable().optional(),
  intervalKm: z.number().int().min(1).max(500_000).nullable().optional(),
  intervalMonths: z.number().int().min(1).max(120).nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
  notes: z.string().max(600).nullable().optional(),
};

export const createMaintenanceSchema = z.object(maintenanceBaseSchema).strict();

export const updateMaintenanceSchema = z
  .object({
    kind: maintenanceBaseSchema.kind.optional(),
    doneAt: maintenanceBaseSchema.doneAt.optional(),
    odometer: maintenanceBaseSchema.odometer,
    intervalKm: maintenanceBaseSchema.intervalKm,
    intervalMonths: maintenanceBaseSchema.intervalMonths,
    cost: maintenanceBaseSchema.cost,
    notes: maintenanceBaseSchema.notes,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Envie ao menos um campo para atualizar',
  });

export const maintenanceIdParamSchema = z.object({
  id: z.string().uuid('id inválido'),
});

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;
export type UpdateMaintenanceInput = z.infer<typeof updateMaintenanceSchema>;
