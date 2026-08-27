import { supabaseAdmin } from '@/config/supabase';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';

export const savedPostsRepository = {
  async exists(postId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('saved_posts')
      .select('post_id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  },

  async create(postId: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('saved_posts')
      .insert({ post_id: postId, user_id: userId });

    if (error) throw error;
  },

  async delete(postId: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('saved_posts')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  /**
   * Ids dos posts salvos, do salvamento mais recente pro mais antigo — a
   * ordem que a lista "Salvos" usa, que não é a ordem de publicação.
   */
  async listSavedPostIds(
    userId: string,
    { limit, offset }: PaginationParams
  ): Promise<{ ids: string[]; total: number }> {
    const { data, error, count } = await supabaseAdmin
      .from('saved_posts')
      .select('post_id', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { ids: (data ?? []).map((row) => row.post_id), total: count ?? 0 };
  },
};
