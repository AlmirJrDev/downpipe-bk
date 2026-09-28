import { supabaseAdmin } from '@/config/supabase';
import { CreateSuggestionInput } from './event-suggestions.schema';

export interface SuggestionRow {
  id: string;
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  ends_at_estimated: boolean;
  location: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  entry_note: string | null;
  attractions: string[];
  rules: string[];
  kind: string | null;
  car_categories: string[];
  source: 'web' | 'usuario' | 'manual';
  source_url: string | null;
  source_note: string | null;
  organizer_instagram: string | null;
  suggested_by: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at: string | null;
  event_id: string | null;
  created_at: string;
  profiles: { username: string } | null;
}

const SELECT = '*, profiles!event_suggestions_suggested_by_fkey ( username )';

function paraBanco(input: CreateSuggestionInput): Record<string, unknown> {
  return {
    name: input.name,
    description: input.description ?? null,
    starts_at: input.startsAt ?? null,
    ends_at: input.endsAt ?? null,
    ends_at_estimated: input.endsAtEstimated ?? false,
    location: input.location ?? null,
    city: input.city ?? null,
    address: input.address ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    entry_note: input.entryNote ?? null,
    attractions: input.attractions ?? [],
    rules: input.rules ?? [],
    kind: input.kind ?? null,
    car_categories: input.carCategories ?? [],
    source_url: input.sourceUrl ?? null,
    source_note: input.sourceNote ?? null,
    organizer_instagram: input.organizerInstagram ?? null,
  };
}

export const eventSuggestionsRepository = {
  /**
   * Devolve null quando a sugestão já existia (mesmo nome e horário).
   *
   * Dois portais noticiando o mesmo encontro, ou dois usuários avisando do
   * mesmo rolê, não podem virar duas linhas pra alguém revisar duas vezes.
   */
  async create(
    input: CreateSuggestionInput,
    origem: { source: 'web' | 'usuario' | 'manual'; suggestedBy?: string | null }
  ): Promise<SuggestionRow | null> {
    const { data, error } = await supabaseAdmin
      .from('event_suggestions')
      .insert({
        ...paraBanco(input),
        source: origem.source,
        suggested_by: origem.suggestedBy ?? null,
      })
      .select(SELECT)
      .single();

    // 23505 = índice único: já tem essa sugestão na fila.
    if (error && error.code === '23505') return null;
    if (error) throw error;
    return data as unknown as SuggestionRow;
  },

  async list(status: 'pending' | 'approved' | 'rejected'): Promise<SuggestionRow[]> {
    const { data, error } = await supabaseAdmin
      .from('event_suggestions')
      .select(SELECT)
      .eq('status', status)
      // Da mais antiga pra mais nova: rolê tem data, e quem chegou primeiro
      // provavelmente acontece primeiro.
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;
    return (data ?? []) as unknown as SuggestionRow[];
  },

  async findById(id: string): Promise<SuggestionRow | null> {
    const { data, error } = await supabaseAdmin
      .from('event_suggestions')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as unknown as SuggestionRow | null;
  },

  async marcar(
    id: string,
    status: 'approved' | 'rejected',
    reviewedBy: string,
    eventId?: string | null
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('event_suggestions')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
        event_id: eventId ?? null,
      })
      .eq('id', id);

    if (error) throw error;
  },

  async contarPendentes(): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('event_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) throw error;
    return count ?? 0;
  },
};
