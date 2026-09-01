import { supabaseAdmin } from '@/config/supabase';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';
import { CreateEventInput, UpdateEventInput } from './events.schema';

export interface EventRow {
  id: string;
  organizer_id: string;
  name: string;
  description: string | null;
  starts_at: string;
  location: string;
  city: string;
  photo_url: string | null;
  visibility: 'public' | 'link';
  latitude: number | null;
  longitude: number | null;
  coords_precision: 'exact' | 'city' | 'pinned' | null;
  created_at: string;
  updated_at: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_organizer: boolean;
  } | null;
  event_attendees: { count: number }[] | null;
}

export interface AttendeeRow {
  user_id: string;
  created_at: string;
  car_id: string | null;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
  cars: {
    id: string;
    version: string | null;
    photo_url: string | null;
    vehicle_versions: {
      name: string;
      year: number;
      vehicle_models: { name: string; vehicle_brands: { name: string } };
    } | null;
  } | null;
}

// O organizador vem junto (join) para o card não precisar de uma requisição
// por evento, mesmo padrão do autor em posts.
//
// `profiles` precisa da FK explícita: event_attendees cria um SEGUNDO caminho
// de events até profiles (many-to-many), e sem nomear a relação o PostgREST
// recusa a consulta inteira com PGRST201.
const EVENT_SELECT = `
  id, organizer_id, name, description, starts_at, location, city, photo_url,
  visibility, latitude, longitude, coords_precision, created_at, updated_at,
  profiles!events_organizer_id_fkey ( username, display_name, avatar_url, is_organizer ),
  event_attendees ( count )
`;

interface ListFilters {
  city?: string;
  past?: boolean;
  organizerId?: string;
  /** Sem isto a listagem pública vazaria os eventos "por link". */
  onlyPublic?: boolean;
  /**
   * Caixa que contém o círculo da busca por raio. É um quadrado, então
   * traz sobra nos cantos — o recorte exato do círculo acontece no service,
   * com haversine.
   */
  bbox?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

export const eventsRepository = {
  async list(
    filters: ListFilters,
    { limit, offset }: PaginationParams
  ): Promise<{ rows: EventRow[]; total: number }> {
    let query = supabaseAdmin.from('events').select(EVENT_SELECT, { count: 'exact' });

    if (filters.onlyPublic) query = query.eq('visibility', 'public');
    if (filters.organizerId) query = query.eq('organizer_id', filters.organizerId);
    if (filters.city) query = query.ilike('city', filters.city);

    if (filters.bbox) {
      query = query
        .gte('latitude', filters.bbox.minLat)
        .lte('latitude', filters.bbox.maxLat)
        .gte('longitude', filters.bbox.minLng)
        .lte('longitude', filters.bbox.maxLng);
    }

    const now = new Date().toISOString();
    if (filters.past) {
      // Passados: do mais recente pro mais antigo (o último rolê primeiro).
      query = query.lt('starts_at', now).order('starts_at', { ascending: false });
    } else {
      // Próximos: o mais perto de acontecer primeiro.
      query = query.gte('starts_at', now).order('starts_at', { ascending: true });
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw error;
    return { rows: (data ?? []) as unknown as EventRow[], total: count ?? 0 };
  },

  async findById(id: string): Promise<EventRow | null> {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select(EVENT_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return (data as unknown as EventRow) ?? null;
  },

  async create(organizerId: string, input: CreateEventInput): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert({
        organizer_id: organizerId,
        name: input.name,
        description: input.description ?? null,
        starts_at: input.startsAt,
        location: input.location,
        city: input.city,
        visibility: input.visibility ?? 'public',
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  },

  async update(id: string, input: UpdateEventInput): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
    if (input.location !== undefined) patch.location = input.location;
    if (input.city !== undefined) patch.city = input.city;
    if (input.visibility !== undefined) patch.visibility = input.visibility;

    const { error } = await supabaseAdmin.from('events').update(patch).eq('id', id);
    if (error) throw error;
  },

  async updatePhoto(id: string, photoUrl: string): Promise<void> {
    const { error } = await supabaseAdmin.from('events').update({ photo_url: photoUrl }).eq('id', id);
    if (error) throw error;
  },

  /** Gravado separado do create/update porque a geocodificação é assíncrona
   * e não pode segurar a resposta se o Nominatim demorar. */
  async updateCoords(
    id: string,
    coords: { latitude: number; longitude: number; precision: 'exact' | 'city' | 'pinned' } | null
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('events')
      .update({
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        coords_precision: coords?.precision ?? null,
      })
      .eq('id', id);

    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('events').delete().eq('id', id);
    if (error) throw error;
  },

  // -------------------------------------------------------------------------
  // Presença
  // -------------------------------------------------------------------------

  async attendanceExists(eventId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('event_attendees')
      .select('event_id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  },

  async createAttendance(
    eventId: string,
    userId: string,
    carId?: string | null
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('event_attendees')
      .insert({ event_id: eventId, user_id: userId, car_id: carId ?? null });

    if (error) throw error;
  },

  /** Trocar (ou tirar) o carro depois de já ter confirmado presença. */
  async updateAttendanceCar(
    eventId: string,
    userId: string,
    carId: string | null
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('event_attendees')
      .update({ car_id: carId })
      .eq('event_id', eventId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async deleteAttendance(eventId: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('event_attendees')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async countAttendees(eventId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('event_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (error) throw error;
    return count ?? 0;
  },

  async listAttendees(
    eventId: string,
    { limit, offset }: PaginationParams
  ): Promise<{ rows: AttendeeRow[]; total: number }> {
    const { data, error, count } = await supabaseAdmin
      .from('event_attendees')
      .select(
        `user_id, created_at, car_id,
         profiles ( username, display_name, avatar_url ),
         cars ( id, version, photo_url, vehicle_versions ( name, year, vehicle_models ( name, vehicle_brands ( name ) ) ) )`, {
        count: 'exact',
      })
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { rows: (data ?? []) as unknown as AttendeeRow[], total: count ?? 0 };
  },

  /**
   * Quantos dos confirmados em cada evento são pessoas que o usuário segue.
   *
   * É o sinal social mais forte da tela: "38 confirmados" é informação,
   * "12 amigos seus" é motivo pra ir. Uma consulta só para todos os eventos
   * da página — contar por evento seria N requisições.
   */
  async countFriendsGoing(
    eventIds: string[],
    followingIds: string[]
  ): Promise<Map<string, number>> {
    if (eventIds.length === 0 || followingIds.length === 0) return new Map();

    const { data, error } = await supabaseAdmin
      .from('event_attendees')
      .select('event_id')
      .in('event_id', eventIds)
      .in('user_id', followingIds);

    if (error) throw error;

    const contagem = new Map<string, number>();
    for (const row of data ?? []) {
      contagem.set(row.event_id, (contagem.get(row.event_id) ?? 0) + 1);
    }
    return contagem;
  },

  /** Quais destes eventos o usuário confirmou — preenche attendingByMe em lote. */
  async findAttendingEventIds(eventIds: string[], userId: string): Promise<Set<string>> {
    if (eventIds.length === 0) return new Set();

    const { data, error } = await supabaseAdmin
      .from('event_attendees')
      .select('event_id')
      .eq('user_id', userId)
      .in('event_id', eventIds);

    if (error) throw error;
    return new Set((data ?? []).map((row) => row.event_id));
  },
};
