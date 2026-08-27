import { AppError } from '@/shared/utils/AppError';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';
import { notificationsRepository, NotificationRow } from './notifications.repository';

function toPublicNotification(row: NotificationRow) {
  return {
    id: row.id,
    type: row.type,
    postId: row.post_id,
    commentId: row.comment_id,
    createdAt: row.created_at,
    readAt: row.read_at,
    actor: row.actor
      ? {
          username: row.actor.username,
          displayName: row.actor.display_name,
          avatarUrl: row.actor.avatar_url,
        }
      : null,
  };
}

export const notificationsService = {
  // ---- Emissão de notificações, chamada pelos outros módulos (likes,
  // comments, follows, posts) sempre que a ação correspondente acontece.
  // Nunca lança erro para o fluxo principal: uma falha ao notificar não
  // deve impedir a ação original de curtir/comentar/seguir/postar.
  async notifyLike(recipientId: string, actorId: string, postId: string) {
    try {
      await notificationsRepository.create({ recipientId, actorId, type: 'like', postId });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Falha ao criar notificação de like:', err);
    }
  },

  async notifyComment(recipientId: string, actorId: string, postId: string, commentId: string) {
    try {
      await notificationsRepository.create({
        recipientId,
        actorId,
        type: 'comment',
        postId,
        commentId,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Falha ao criar notificação de comment:', err);
    }
  },

  async notifyFollow(recipientId: string, actorId: string) {
    try {
      await notificationsRepository.create({ recipientId, actorId, type: 'follow' });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Falha ao criar notificação de follow:', err);
    }
  },

  async notifyProjectUpdate(followerIds: string[], actorId: string, postId: string) {
    try {
      await notificationsRepository.createMany(
        followerIds.map((recipientId) => ({ recipientId, actorId, type: 'project_update', postId }))
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Falha ao criar notificações de project_update:', err);
    }
  },

  // ---- Leitura, usada pelos endpoints REST de notificações.
  async list(recipientId: string, unreadOnly: boolean, pagination: PaginationParams) {
    const { rows, total } = await notificationsRepository.listByRecipient(
      recipientId,
      unreadOnly,
      pagination
    );
    return { notifications: rows.map(toPublicNotification), total };
  },

  async countUnread(recipientId: string) {
    return notificationsRepository.countUnread(recipientId);
  },

  async markRead(id: string, userId: string) {
    const notification = await notificationsRepository.findById(id);

    if (!notification) {
      throw AppError.notFound('NOTIFICATION_NOT_FOUND', 'Notificação não encontrada');
    }

    if (notification.recipient_id !== userId) {
      throw AppError.forbidden('Você só pode marcar como lidas as suas próprias notificações');
    }

    await notificationsRepository.markRead(id);
  },

  async markAllRead(userId: string) {
    await notificationsRepository.markAllRead(userId);
  },
};
