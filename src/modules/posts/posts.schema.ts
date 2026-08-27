import { z } from 'zod';

export const postTypeEnum = z.enum(['normal', 'project_update', 'evolution']);

/**
 * Campos de texto aceitos na criação/edição de um post. O upload das
 * mídias (imagens) é feito via multipart/form-data no campo "files" - não
 * faz parte deste schema, que valida apenas req.body.
 */
const postBaseSchema = {
  carId: z.string().uuid('carId inválido').nullable().optional(),
  type: postTypeEnum.optional(),
  title: z.string().max(120).nullable().optional(),
  subtitle: z.string().max(200).nullable().optional(),
  caption: z.string().max(2000).nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
  progressPercent: z.number().int().min(0).max(100).nullable().optional(),
};

/**
 * POST /posts é enviado como multipart/form-data (por causa do upload de
 * mídias), então campos numéricos chegam como string em req.body. Usamos
 * z.coerce apenas aqui; PATCH /posts/:id continua em JSON puro e usa o
 * schema numérico "estrito" (permitindo null explícito para limpar campo).
 */
const multipartNumberOrNull = (schema: z.ZodNumber) =>
  z.preprocess((val) => {
    if (val === '' || val === undefined) return undefined;
    if (val === 'null') return null;
    if (typeof val === 'string') return Number(val);
    return val;
  }, schema.nullable().optional());

export const createPostSchema = z
  .object({
    carId: postBaseSchema.carId,
    type: postBaseSchema.type,
    title: postBaseSchema.title,
    subtitle: postBaseSchema.subtitle,
    caption: postBaseSchema.caption,
    cost: multipartNumberOrNull(z.number().min(0)),
    progressPercent: multipartNumberOrNull(z.number().int().min(0).max(100)),
  })
  .strict();

/**
 * Na edição, o tipo e o carro associado não podem ser trocados (evita
 * inconsistência com as mídias já enviadas) - apenas os campos de texto.
 */
export const updatePostSchema = z
  .object({
    title: postBaseSchema.title,
    subtitle: postBaseSchema.subtitle,
    caption: postBaseSchema.caption,
    cost: postBaseSchema.cost,
    progressPercent: postBaseSchema.progressPercent,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Envie ao menos um campo para atualizar',
  });

export const postIdParamSchema = z.object({
  id: z.string().uuid('id inválido'),
});

export const carIdParamSchema = z.object({
  carId: z.string().uuid('carId inválido'),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
