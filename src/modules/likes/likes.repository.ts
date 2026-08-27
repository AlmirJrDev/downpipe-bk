import { supabaseAdmin } from '@/config/supabase';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';

export interface LikerRow {
  user_id: string;
  created_at: string;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
}

export const likesRepository = {
  async exists(postId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('post_likes')
      .select('post_id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  },

  async create(postId: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin.from('post_likes').insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  },

  async delete(postId: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async count(postId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    if (error) throw error;
    return count ?? 0;
  },

  async listLikers(
    postId: string,
    { limit, offset }: PaginationParams
  ): Promise<{ rows: LikerRow[]; total: number }> {
    const { data, error, count } = await supabaseAdmin
      .from('post_likes')
      .select('user_id, created_at, profiles ( username, display_name, avatar_url )', {
        count: 'exact',
      })
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { rows: (data ?? []) as unknown as LikerRow[], total: count ?? 0 };
  },
};
