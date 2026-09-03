import { AppError } from '@/shared/utils/AppError';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';
import { profilesRepository } from '@/modules/profiles/profiles.repository';
import { pushService } from '@/shared/push/push.service';
import { notificationsRepository, NotificationRow } from './notifications.repository';

/**
 * Push por tipo de notificação — mesma copy que a lista dentro do app usa
 * (app/notifications.tsx), pra quem recebe o toque na tela e quem recebe
 * no sininho lerem a mesma frase.
 *
 * "like" fica de fora de propósito: é o tipo de maior volume e menor
 * intenção — cinco curtidas numa foto seriam cinco toques no celular por
 * algo que não pede ação nenhuma. Continua aparecendo no sininho.
 */
type TipoComPush = 'comment' | 'follow' | 'project_update' | 'event_attend' | 'car_tag';

const FRASE: Record<TipoComPush, string> = {
  comment: 'comentou na sua publicação',
  follow: 'começou a seguir você',
  project_update: 'publicou uma atualização do projeto',
  event_attend: 'vai num rolê',
  car_tag: 'marcou seu carro numa foto',
};

/**
 * Monta e dispara o push de um tipo específico. Nunca lança — a mesma regra
 * de "notificar não pode derrubar a ação original" que já vale pro registro
 * interno vale aqui, com um motivo a mais: isto faz uma consulta de perfil
 * a mais, e essa consulta também não pode virar 500 pra quem só queria
 * curtir um post.
 *
 * `recipientUsername` só é buscado para "comment": é o único tipo em que a
 * tela de destino é o PRÓPRIO perfil de quem recebe (ver app/notifications.tsx,
 * a função `open`) — os outros tipos levam pro perfil de quem agiu ou pro
 * evento, que já vêm resolvidos sem outra consulta.
 */
async function push(
  tipo: TipoComPush,
  recipientId: string,
  actorId: string,
  extra: { postId?: string; eventId?: string }
) {
  try {
    const actor = await profilesRepository.findById(actorId);
    if (!actor) return;

    let url: string;
    switch (tipo) {
      case 'follow':
        url = `/app/user/${actor.username}`;
        break;
      case 'event_attend':
        url = `/app/event/${extra.eventId}`;
        break;
      case 'project_update':
      case 'car_tag':
        url = `/app/user-posts/${actor.username}?postId=${extra.postId}`;
        break;
      case 'comment': {
        const recipient = await profilesRepository.findById(recipientId);
        if (!recipient) return;
        url = `/app/user-posts/${recipient.username}?postId=${extra.postId}`;
        break;
      }
    }

    await pushService.sendToUser(recipientId, {
      title: actor.display_name,
      body: FRASE[tipo],
      url,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`Falha ao montar push de ${tipo}:`, err);
  }
}

function toPublicNotification(row: NotificationRow) {
  return {
    id: row.id,
    type: row.type,
    postId: row.post_id,
    commentId: row.comment_id,
    eventId: row.event_id,
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
    void push('comment', recipientId, actorId, { postId });
  },

  async notifyFollow(recipientId: string, actorId: string) {
    try {
      await notificationsRepository.create({ recipientId, actorId, type: 'follow' });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Falha ao criar notificação de follow:', err);
    }
    void push('follow', recipientId, actorId, {});
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
    for (const recipientId of followerIds) void push('project_update', recipientId, actorId, { postId });
  },

  /**
   * "Alguém que você segue vai nesse evento" — vai para os seguidores de
   * quem confirmou, não para o organizador. É o gancho que transforma uma
   * agenda em motivo pra ir: o valor está em saber que a sua turma vai.
   */
  async notifyEventAttend(followerIds: string[], actorId: string, eventId: string) {
    try {
      await notificationsRepository.createMany(
        followerIds.map((recipientId) => ({ recipientId, actorId, type: 'event_attend', eventId }))
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Falha ao criar notificações de event_attend:', err);
    }
    for (const recipientId of followerIds) void push('event_attend', recipientId, actorId, { eventId });
  },

  /** Marcaram o carro de alguém numa foto — o aviso que faz a marcação
   * pendente não morrer em silêncio. */
  async notifyCarTag(recipientId: string, actorId: string, postId: string) {
    try {
      await notificationsRepository.create({ recipientId, actorId, type: 'car_tag', postId });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Falha ao criar notificação de car_tag:', err);
    }
    void push('car_tag', recipientId, actorId, { postId });
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
