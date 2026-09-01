import { supabaseAdmin } from '@/config/supabase';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'project_update'
  | 'event_attend'
  | 'car_tag';

export interface NotificationRow {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  event_id: string | null;
  created_at: string;
  read_at: string | null;
  actor: { username: string; display_name: string; avatar_url: string | null } | null;
}

const NOTIFICATION_SELECT = `
  id, recipient_id, actor_id, type, post_id, comment_id, event_id, created_at, read_at,
  actor:profiles!notifications_actor_id_fkey ( username, display_name, avatar_url )
`;

export const notificationsRepository = {
  async create(params: {
    recipientId: string;
    actorId: string;
    type: NotificationType;
    postId?: string | null;
    commentId?: string | null;
    eventId?: string | null;
  }): Promise<void> {
    // Um usuário não recebe notificação de uma ação feita por ele mesmo
    // (ex.: comentar no próprio post).
    if (params.recipientId === params.actorId) return;

    const { error } = await supabaseAdmin.from('notifications').insert({
      recipient_id: params.recipientId,
      actor_id: params.actorId,
      type: params.type,
      post_id: params.postId ?? null,
      comment_id: params.commentId ?? null,
      event_id: params.eventId ?? null,
    });

    if (error) throw error;
  },

  async createMany(
    items: {
      recipientId: string;
      actorId: string;
      type: NotificationType;
      postId?: string | null;
      eventId?: string | null;
    }[]
  ): Promise<void> {
    const rows = items
      .filter((item) => item.recipientId !== item.actorId)
      .map((item) => ({
        recipient_id: item.recipientId,
        actor_id: item.actorId,
        type: item.type,
        post_id: item.postId ?? null,
        event_id: item.eventId ?? null,
      }));

    if (rows.length === 0) return;

    const { error } = await supabaseAdmin.from('notifications').insert(rows);
    if (error) throw error;
  },

  async listByRecipient(
    recipientId: string,
    unreadOnly: boolean,
    { limit, offset }: PaginationParams
  ): Promise<{ rows: NotificationRow[]; total: number }> {
    let query = supabaseAdmin
      .from('notifications')
      .select(NOTIFICATION_SELECT, { count: 'exact' })
      .eq('recipient_id', recipientId);

    if (unreadOnly) query = query.is('read_at', null);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { rows: (data ?? []) as unknown as NotificationRow[], total: count ?? 0 };
  },

  async findById(id: string): Promise<NotificationRow | null> {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select(NOTIFICATION_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as unknown as NotificationRow | null;
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async markAllRead(recipientId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', recipientId)
      .is('read_at', null);

    if (error) throw error;
  },

  async countUnread(recipientId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', recipientId)
      .is('read_at', null);

    if (error) throw error;
    return count ?? 0;
  },
};
