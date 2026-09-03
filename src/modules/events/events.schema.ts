import { z } from 'zod';

export const eventVisibilityEnum = z.enum(['public', 'link']);

const eventBaseSchema = {
  name: z.string().min(1, 'name é obrigatório').max(120),
  description: z.string().max(2000).nullable().optional(),
  /** ISO 8601 com hora — encontro tem horário, não só data. */
  startsAt: z.string().datetime({ offset: true, message: 'startsAt deve ser uma data ISO 8601' }),
  location: z.string().min(1, 'location é obrigatório').max(200),
  city: z.string().min(1, 'city é obrigatória').max(80),
  /**
   * Rua e número, resolvidos a partir do pino no mapa (geocodificação
   * reversa) — complementar a "location", que é como o pessoal chama o
   * lugar ("Posto Graal"), não substituto. Null quando não há coordenada
   * ou o ponto caiu onde o Nominatim não soube nomear.
   */
  address: z.string().max(300).nullable().optional(),
  visibility: eventVisibilityEnum.optional(),
  /**
   * Coordenada escolhida pelo organizador (pino no mapa, GPS ou sugestão de
   * endereço). Quando vem, manda: o servidor grava como 'pinned' e nem
   * tenta geocodificar. Geocodificar é palpite; isto é a escolha de quem
   * sabe onde é o rolê.
   */
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
};

export const createEventSchema = z.object(eventBaseSchema).strict();

export const updateEventSchema = z
  .object({
    ...eventBaseSchema,
    name: eventBaseSchema.name.optional(),
    startsAt: eventBaseSchema.startsAt.optional(),
    location: eventBaseSchema.location.optional(),
    city: eventBaseSchema.city.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Envie ao menos um campo para atualizar',
  });

/**
 * Filtros da listagem pública. `past` existe porque o padrão é só o que
 * ainda vai acontecer — um calendário que abre mostrando encontro do mês
 * passado não serve pra nada.
 */
export const listEventsQuerySchema = z
  .object({
    city: z.string().max(80).optional(),
    past: z
      .enum(['true', 'false'])
      .optional()
      .transform((val) => val === 'true'),
    /**
     * Centro e raio da busca. O raio vai até 500 km porque essa turma
     * viaja: 150 km para um encontro bom é rotina, e um limite curto
     * esconderia justamente os rolês que valem a viagem.
     */
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().min(1).max(500).optional(),
  })
  .refine((data) => (data.lat === undefined) === (data.lng === undefined), {
    message: 'Envie lat e lng juntos',
  });

export const eventIdParamSchema = z.object({
  id: z.string().uuid('id inválido'),
});

export const eventIdAttendParamSchema = z.object({
  eventId: z.string().uuid('eventId inválido'),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

export const attendBodySchema = z.object({
  /** Carro que a pessoa vai levar. Opcional e anulável: nem todo mundo vai
   * de carro, e dá pra tirar depois. */
  carId: z.string().uuid('carId inválido').nullable().optional(),
});

export const attendanceCarSchema = z.object({
  carId: z.string().uuid('carId inválido').nullable(),
});
