import { supabaseAdmin } from '@/config/supabase';
import { UpdateProfileInput } from './profiles.schema';

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  gearhead_since: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Camada de acesso a dados do módulo profiles. Usa o client "admin" (service
 * role) porque as regras de autorização (usuário só edita o próprio profile)
 * já são garantidas pela camada de serviço + RLS ao nível do banco.
 */
export const profilesRepository = {
  async findById(id: string): Promise<ProfileRow | null> {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findByUsername(username: string): Promise<ProfileRow | null> {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async isUsernameTaken(username: string, excludingId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', excludingId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  },

  async search(query: string, limit = 10): Promise<ProfileRow[]> {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  },

  async update(id: string, input: UpdateProfileInput): Promise<ProfileRow> {
    const payload: Record<string, unknown> = {};

    if (input.username !== undefined) payload.username = input.username;
    if (input.displayName !== undefined) payload.display_name = input.displayName;
    if (input.bio !== undefined) payload.bio = input.bio;
    if (input.avatarUrl !== undefined) payload.avatar_url = input.avatarUrl;
    if (input.gearheadSince !== undefined) payload.gearhead_since = input.gearheadSince;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  // Contadores usados no endpoint público GET /profiles/:username.
  async getPublicCounts(profileId: string) {
    const [followersResult, followingResult, carsResult, projectsResult] = await Promise.all([
      supabaseAdmin.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileId),
      supabaseAdmin.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileId),
      supabaseAdmin.from('cars').select('*', { count: 'exact', head: true }).eq('owner_id', profileId),
      // projeto existe apenas para carros do usuário: filtra projects cujo car_id pertence a esse owner.
      supabaseAdmin
        .from('projects')
        .select('id, cars!inner(owner_id)', { count: 'exact', head: true })
        .eq('cars.owner_id', profileId),
    ]);

    if (followersResult.error) throw followersResult.error;
    if (followingResult.error) throw followingResult.error;
    if (carsResult.error) throw carsResult.error;
    if (projectsResult.error) throw projectsResult.error;

    return {
      followersCount: followersResult.count ?? 0,
      followingCount: followingResult.count ?? 0,
      carsCount: carsResult.count ?? 0,
      projectsCount: projectsResult.count ?? 0,
    };
  },
};
