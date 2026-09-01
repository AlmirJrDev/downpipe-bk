import { z } from 'zod';

export const usernameSchema = z
  .string()
  .min(3, 'Username deve ter ao menos 3 caracteres')
  .max(30, 'Username deve ter no máximo 30 caracteres')
  .regex(/^[a-z0-9_.]+$/, 'Username deve conter apenas letras minúsculas, números, "_" e "."');

export const updateProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    displayName: z.string().min(1).max(60).optional(),
    bio: z.string().max(300, 'Bio deve ter no máximo 300 caracteres').nullable().optional(),
    avatarUrl: z.string().url('avatarUrl deve ser uma URL válida').nullable().optional(),
    gearheadSince: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear())
      .nullable()
      .optional(),
    /**
     * Marca de organizador de eventos. É uma marca no perfil que já existe,
     * e não um segundo tipo de conta: quem organiza encontro costuma ter
     * carro também, e duas contas obrigariam a manter dois logins.
     */
    isOrganizer: z.boolean().optional(),
  })
  .strict()
  // impede explicitamente qualquer tentativa de sobrescrever o id via body
  .refine((data) => !('id' in data), { message: 'Campo "id" não pode ser alterado' });

export const usernameParamSchema = z.object({
  username: usernameSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
