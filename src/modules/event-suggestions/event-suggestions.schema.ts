import { z } from 'zod';
import { instagramSchema } from '@/shared/validation/instagram';
import {
  attractionEnum,
  eventCarCategoryEnum,
  eventKindEnum,
  eventRuleEnum,
} from '@/modules/events/events.schema';

/**
 * O que se aceita numa sugestão de rolê.
 *
 * Quase tudo é opcional de propósito: quem viu um story na rua manda o nome e
 * a cidade, não o endereço com CEP. O que falta se completa na hora de
 * aprovar — e uma sugestão incompleta ainda é melhor do que o encontro
 * passar batido.
 */
export const createSuggestionSchema = z
  .object({
    name: z.string().min(3, 'Diga o nome do rolê').max(120),
    description: z.string().max(2000).nullable().optional(),
    startsAt: z.string().datetime({ offset: true }).nullable().optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    endsAtEstimated: z.boolean().optional(),
    location: z.string().max(200).nullable().optional(),
    city: z.string().max(80).nullable().optional(),
    address: z.string().max(300).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    entryNote: z.string().max(120).nullable().optional(),
    attractions: z.array(attractionEnum).max(12).optional(),
    rules: z.array(eventRuleEnum).max(8).optional(),
    kind: eventKindEnum.nullable().optional(),
    carCategories: z.array(eventCarCategoryEnum).max(7).optional(),
    /** Link do post, da notícia, do calendário — o que dá pra conferir. */
    sourceUrl: z.string().url('sourceUrl deve ser uma URL').max(500).nullable().optional(),
    /** "Visto no story do @fulano", "cartaz no posto". */
    sourceNote: z.string().max(200).nullable().optional(),
    /**
     * O @ de quem organiza. Vai junto pro rolê publicado: o encontro é dele,
     * não de quem aprovou a sugestão aqui dentro.
     */
    organizerInstagram: instagramSchema,
  })
  .strict();

/** Quem aprova pode corrigir tudo antes de publicar — data errada é o caso comum. */
export const approveSuggestionSchema = createSuggestionSchema.partial().extend({
  /** Sem data e lugar não existe rolê; a aprovação é onde isso é exigido. */
  startsAt: z.string().datetime({ offset: true }),
  location: z.string().min(1).max(200),
  city: z.string().min(1).max(80),
});

export const suggestionIdParamSchema = z.object({
  id: z.string().uuid('id inválido'),
});

export const listSuggestionsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
});

export type CreateSuggestionInput = z.infer<typeof createSuggestionSchema>;
export type ApproveSuggestionInput = z.infer<typeof approveSuggestionSchema>;
