import { supabaseAdmin } from '@/config/supabase';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';
import { CreatePostInput, UpdatePostInput } from './posts.schema';

export interface PostMediaRow {
  id: string;
  media_url: string;
  media_type: string;
  position: number;
}

export interface PostRow {
  id: string;
  author_id: string;
  car_id: string | null;
  car_tag_status: "approved" | "pending" | null;
  event_id: string | null;
  type: string;
  title: string | null;
  subtitle: string | null;
  caption: string | null;
  cost: number | null;
  progress_percent: number | null;
  created_at: string;
  updated_at: string;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
  cars: {
    owner_id: string;
    id: string;
    version: string | null;
    photo_url: string | null;
    vehicle_versions: {
      name: string;
      year: number;
      vehicle_models: { name: string; vehicle_brands: { name: string } };
    } | null;
  } | null;
  events: { id: string; name: string; starts_at: string; city: string } | null;
  post_media: PostMediaRow[];
  post_likes: { count: number }[];
  comments: { count: number }[];
}

// profiles!posts_author_id_fkey (não só "profiles"): posts_likes também tem
// FK pra profiles, então o PostgREST enxerga dois caminhos posts->profiles
// (direto via author_id, e many-to-many via post_likes) e recusa a query
// como ambígua sem essa qualificação explícita.
const POST_SELECT = `
  id, author_id, car_id, car_tag_status, event_id, type, title, subtitle, caption, cost, progress_percent,
  created_at, updated_at,
  profiles!posts_author_id_fkey ( username, display_name, avatar_url ),
  cars ( id, owner_id, version, photo_url, vehicle_versions ( name, year, vehicle_models ( name, vehicle_brands ( name ) ) ) ),
  post_media ( id, media_url, media_type, position ),
  events!posts_event_id_fkey ( id, name, starts_at, city ),
  post_likes ( count ),
  comments ( count )
`;

/** O status da marcação não vem do cliente: quem decide é o service, olhando
 * se quem publicou é o dono do carro. */
type CreateWithTag = CreatePostInput & { carTagStatus?: 'approved' | 'pending' };

function toDbPayload(input: CreateWithTag): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (input.carId !== undefined) payload.car_id = input.carId;
  // O status vem calculado pelo service (dono = aprovado, terceiro = pendente).
  if (input.carTagStatus !== undefined) payload.car_tag_status = input.carTagStatus;
  if (input.eventId !== undefined) payload.event_id = input.eventId;
  if (input.type !== undefined) payload.type = input.type;
  if (input.title !== undefined) payload.title = input.title;
  if (input.subtitle !== undefined) payload.subtitle = input.subtitle;
  if (input.caption !== undefined) payload.caption = input.caption;
  if (input.cost !== undefined) payload.cost = input.cost;
  if (input.progressPercent !== undefined) payload.progress_percent = input.progressPercent;

  return payload;
}

function toUpdateDbPayload(input: UpdatePostInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (input.title !== undefined) payload.title = input.title;
  if (input.subtitle !== undefined) payload.subtitle = input.subtitle;
  if (input.caption !== undefined) payload.caption = input.caption;
  if (input.cost !== undefined) payload.cost = input.cost;
  if (input.progressPercent !== undefined) payload.progress_percent = input.progressPercent;

  return payload;
}

export const postsRepository = {
  async list(
    filters: {
      authorId?: string;
      carId?: string;
      eventId?: string;
      authorIdIn?: string[];
      excludeIds?: string[];
      idIn?: string[];
    },
    { limit, offset }: PaginationParams
  ): Promise<{ rows: PostRow[]; total: number }> {
    let query = supabaseAdmin.from('posts').select(POST_SELECT, { count: 'exact' });

    if (filters.authorId) query = query.eq('author_id', filters.authorId);
    if (filters.carId) {
      query = query.eq("car_id", filters.carId);
      // A página do carro mostra só o que o dono aprovou. Marcação pendente
      // existe no post de quem fotografou, não no carro dos outros.
      query = query.eq("car_tag_status", "approved");
    }
    if (filters.eventId) query = query.eq("event_id", filters.eventId);
    if (filters.authorIdIn) query = query.in('author_id', filters.authorIdIn);
    if (filters.idIn) query = query.in('id', filters.idIn);
    if (filters.excludeIds && filters.excludeIds.length > 0) {
      query = query.not('id', 'in', `(${filters.excludeIds.join(',')})`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .order('position', { referencedTable: 'post_media', ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { rows: (data ?? []) as unknown as PostRow[], total: count ?? 0 };
  },

  async findById(id: string): Promise<PostRow | null> {
    const { data, error } = await supabaseAdmin
      .from('posts')
      .select(POST_SELECT)
      .eq('id', id)
      .order('position', { referencedTable: 'post_media', ascending: true })
      .maybeSingle();

    if (error) throw error;
    return data as unknown as PostRow | null;
  },

  async create(authorId: string, input: CreateWithTag): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert({ author_id: authorId, ...toDbPayload(input) })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  },

  async update(id: string, input: UpdatePostInput): Promise<void> {
    const { error } = await supabaseAdmin.from('posts').update(toUpdateDbPayload(input)).eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('posts').delete().eq('id', id);
    if (error) throw error;
  },

  /** Dono aceitou a marcação: a foto passa a aparecer na página do carro. */
  async approveCarTag(postId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('posts')
      .update({ car_tag_status: 'approved' })
      .eq('id', postId);

    if (error) throw error;
  },

  /**
   * Dono recusou: some o vínculo, mas a publicação continua — ela é de quem
   * fotografou. Não guarda "recusado": o dado não teria uso e só serviria
   * pra alguém ficar remoendo.
   */
  async rejectCarTag(postId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('posts')
      .update({ car_id: null, car_tag_status: null })
      .eq('id', postId);

    if (error) throw error;
  },

  async insertMedia(
    postId: string,
    items: { mediaUrl: string; mediaType: 'image' | 'video'; position: number }[]
  ): Promise<void> {
    if (items.length === 0) return;

    const { error } = await supabaseAdmin.from('post_media').insert(
      items.map((item) => ({
        post_id: postId,
        media_url: item.mediaUrl,
        media_type: item.mediaType,
        position: item.position,
      }))
    );

    if (error) throw error;
  },

  async listMediaByPost(postId: string): Promise<PostMediaRow[]> {
    const { data, error } = await supabaseAdmin
      .from('post_media')
      .select('id, media_url, media_type, position')
      .eq('post_id', postId);

    if (error) throw error;
    return data ?? [];
  },

  /** Ids, dentre os informados, que o usuário curtiu — usado para preencher likedByMe. */
  async findLikedPostIds(postIds: string[], userId: string): Promise<Set<string>> {
    if (postIds.length === 0) return new Set();

    const { data, error } = await supabaseAdmin
      .from('post_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);

    if (error) throw error;
    return new Set((data ?? []).map((row) => row.post_id));
  },

  /** Mesma ideia do findLikedPostIds, para preencher savedByMe. */
  async findSavedPostIds(postIds: string[], userId: string): Promise<Set<string>> {
    if (postIds.length === 0) return new Set();

    const { data, error } = await supabaseAdmin
      .from('saved_posts')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);

    if (error) throw error;
    return new Set((data ?? []).map((row) => row.post_id));
  },

  async countAll(): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('posts')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count ?? 0;
  },
};
