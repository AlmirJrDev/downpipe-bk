import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/modules/notifications/notifications.repository', () => ({
  notificationsRepository: {
    create: vi.fn(),
    createMany: vi.fn(),
    listByRecipient: vi.fn(),
    findById: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    countUnread: vi.fn(),
  },
}));

import { notificationsService } from '@/modules/notifications/notifications.service';
import { notificationsRepository } from '@/modules/notifications/notifications.repository';

const USER_A = '123e4567-e89b-12d3-a456-426614174000';
const USER_B = '223e4567-e89b-12d3-a456-426614174000';
const POST_ID = '323e4567-e89b-12d3-a456-426614174000';

describe('notificationsService.notifyLike', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cria a notificação quando o autor da curtida é diferente do dono do post', async () => {
    await notificationsService.notifyLike(USER_B, USER_A, POST_ID);

    expect(notificationsRepository.create).toHaveBeenCalledWith({
      recipientId: USER_B,
      actorId: USER_A,
      type: 'like',
      postId: POST_ID,
    });
  });

  it('não lança erro para o fluxo principal se a criação da notificação falhar', async () => {
    vi.mocked(notificationsRepository.create).mockRejectedValue(new Error('boom'));

    await expect(notificationsService.notifyLike(USER_B, USER_A, POST_ID)).resolves.toBeUndefined();
  });
});

describe('notificationsService.markRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejeita marcar como lida uma notificação de outro usuário', async () => {
    vi.mocked(notificationsRepository.findById).mockResolvedValue({
      id: 'notif-1',
      recipient_id: USER_B,
      actor_id: USER_A,
      type: 'like',
      post_id: POST_ID,
      comment_id: null,
      created_at: new Date().toISOString(),
      read_at: null,
      actor: null,
    });

    await expect(notificationsService.markRead('notif-1', USER_A)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(notificationsRepository.markRead).not.toHaveBeenCalled();
  });

  it('marca como lida quando o usuário é o destinatário', async () => {
    vi.mocked(notificationsRepository.findById).mockResolvedValue({
      id: 'notif-1',
      recipient_id: USER_A,
      actor_id: USER_B,
      type: 'follow',
      post_id: null,
      comment_id: null,
      created_at: new Date().toISOString(),
      read_at: null,
      actor: null,
    });

    await notificationsService.markRead('notif-1', USER_A);

    expect(notificationsRepository.markRead).toHaveBeenCalledWith('notif-1');
  });

  it('lança 404 quando a notificação não existe', async () => {
    vi.mocked(notificationsRepository.findById).mockResolvedValue(null);

    await expect(notificationsService.markRead('notif-x', USER_A)).rejects.toMatchObject({
      code: 'NOTIFICATION_NOT_FOUND',
    });
  });
});
