import { z } from 'zod';

export const eventVisibilityEnum = z.enum(['public', 'link']);

/**
 * O que o rolê oferece. Vocabulário fechado porque vira chip na tela e
 * filtro depois; "outros" cobre o que a cena inventar sem exigir migration.
 */
export const attractionEnum = z.enum([
  'food_truck',
  'bar',
  'espaco_kids',
  'som',
  'lojas',
  'premiacao',
  'sorteio',
  'estacionamento',
  'banheiro',
  'area_coberta',
  'pet_friendly',
  'beneficente',
]);

/**
 * O que não pode. É a lista que evita o encontro acabar cedo com o dono do
 * posto expulsando todo mundo.
 */
export const eventRuleEnum = z.enum([
  'sem_som_alto',
  'sem_acelerar',
  'sem_arrancada',
  'sem_borrachao',
  'sem_bebida',
  'sem_drift',
  'sem_menores',
  'sem_animais',
]);

/** Que tipo de encontro é. Muda o que a pessoa espera ao chegar. */
export const eventKindEnum = z.enum([
  'encontro',
  'exposicao',
  'passeio',
  'drift',
  'arrancada',
  'track_day',
  'off_road',
  'beneficente',
]);

/** Mesmas categorias dos carros do app: é o que valida a presença. */
export const eventCarCategoryEnum = z.enum([
  'JDM',
  'Euro',
  'Muscle',
  'Performance',
  'Clássicos',
  'Stance',
  'Other',
]);

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

  /**
   * Fim do rolê. Quase sempre é palpite — `endsAtEstimated` diz isso pra
   * tela, que escreve "até por volta das 22h" em vez de prometer hora certa.
   */
  endsAt: z
    .string()
    .datetime({ offset: true, message: 'endsAt deve ser uma data ISO 8601' })
    .nullable()
    .optional(),
  endsAtEstimated: z.boolean().optional(),

  /** "1 kg de alimento", "R$ 10 por carro", "entrada franca". */
  entryNote: z.string().max(120).nullable().optional(),

  attractions: z.array(attractionEnum).max(12).optional(),
  rules: z.array(eventRuleEnum).max(8).optional(),
  kind: eventKindEnum.nullable().optional(),
  /** Vazio = qualquer carro, que é a maioria dos encontros. */
  carCategories: z.array(eventCarCategoryEnum).max(7).optional(),

  /**
   * De onde veio a informação, quando o rolê não é nosso. Publicar encontro
   * dos outros sem dizer a fonte se apropria do trabalho de quem organiza e
   * esconde de quem lê que aquilo é de segunda mão.
   */
  sourceUrl: z.string().url().max(500).nullable().optional(),
  sourceNote: z.string().max(200).nullable().optional(),
};

/** Rolê que termina antes de começar é erro de digitação, não escolha. */
const fimDepoisDoInicio = (data: { startsAt?: string; endsAt?: string | null }) =>
  !data.endsAt || !data.startsAt || Date.parse(data.endsAt) > Date.parse(data.startsAt);

export const createEventSchema = z
  .object(eventBaseSchema)
  .strict()
  .refine(fimDepoisDoInicio, {
    message: 'O fim do rolê tem que ser depois do começo',
    path: ['endsAt'],
  });

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
  })
  .refine(fimDepoisDoInicio, {
    message: 'O fim do rolê tem que ser depois do começo',
    path: ['endsAt'],
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
