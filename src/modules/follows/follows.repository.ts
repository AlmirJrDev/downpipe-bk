import { supabaseAdmin } from '@/config/supabase';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';

export interface FollowProfileRow {
  created_at: string;
  profiles: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
}

export const followsRepository = {
  async exists(followerId: string, followingId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('follows')
      .select('follower_id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  },

  async create(followerId: string, followingId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('follows')
      .insert({ follower_id: followerId, following_id: followingId });

    if (error) throw error;
  },

  async delete(followerId: string, followingId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) throw error;
  },

  async countFollowers(userId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);

    if (error) throw error;
    return count ?? 0;
  },

  async countFollowing(userId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId);

    if (error) throw error;
    return count ?? 0;
  },

  async listFollowers(
    userId: string,
    { limit, offset }: PaginationParams
  ): Promise<{ rows: FollowProfileRow[]; total: number }> {
    const { data, error, count } = await supabaseAdmin
      .from('follows')
      .select('created_at, profiles!follows_follower_id_fkey ( id, username, display_name, avatar_url )', {
        count: 'exact',
      })
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { rows: (data ?? []) as unknown as FollowProfileRow[], total: count ?? 0 };
  },

  async listFollowing(
    userId: string,
    { limit, offset }: PaginationParams
  ): Promise<{ rows: FollowProfileRow[]; total: number }> {
    const { data, error, count } = await supabaseAdmin
      .from('follows')
      .select('created_at, profiles!follows_following_id_fkey ( id, username, display_name, avatar_url )', {
        count: 'exact',
      })
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { rows: (data ?? []) as unknown as FollowProfileRow[], total: count ?? 0 };
  },

  /** Lista simples de ids seguidos por um usuário — usada pelo feed (Fase 5/6). */
  async listFollowingIds(userId: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (error) throw error;
    return (data ?? []).map((row) => row.following_id);
  },

  /** Lista simples de ids de seguidores de um usuário — usada para notificar
   * seguidores quando o usuário publica um post de tipo 'project_update'. */
  async listFollowerIds(userId: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin
      .from('follows')
      .select('follower_id')
      .eq('following_id', userId);

    if (error) throw error;
    return (data ?? []).map((row) => row.follower_id);
  },
};
