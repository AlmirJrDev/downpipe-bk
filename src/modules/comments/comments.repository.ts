import { supabaseAdmin } from '@/config/supabase';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';

export interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  text: string;
  created_at: string;
  updated_at: string;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
}

const COMMENT_SELECT = `
  id, post_id, author_id, text, created_at, updated_at,
  profiles ( username, display_name, avatar_url )
`;

export const commentsRepository = {
  async listByPost(
    postId: string,
    { limit, offset }: PaginationParams
  ): Promise<{ rows: CommentRow[]; total: number }> {
    const { data, error, count } = await supabaseAdmin
      .from('comments')
      .select(COMMENT_SELECT, { count: 'exact' })
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { rows: (data ?? []) as unknown as CommentRow[], total: count ?? 0 };
  },

  async findById(id: string): Promise<CommentRow | null> {
    const { data, error } = await supabaseAdmin
      .from('comments')
      .select(COMMENT_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as unknown as CommentRow | null;
  },

  async create(postId: string, authorId: string, text: string): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('comments')
      .insert({ post_id: postId, author_id: authorId, text })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  },

  async update(id: string, text: string): Promise<void> {
    const { error } = await supabaseAdmin.from('comments').update({ text }).eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('comments').delete().eq('id', id);
    if (error) throw error;
  },
};
