import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/modules/moderation/moderation.repository', () => ({
  moderationRepository: {
    createReport: vi.fn(),
    listAdminIds: vi.fn(),
    describeTarget: vi.fn(),
  },
}));

vi.mock('@/modules/notifications/notifications.repository', () => ({
  notificationsRepository: { countUnread: vi.fn() },
}));

vi.mock('@/shared/push/push.service', () => ({
  pushService: { sendToUser: vi.fn() },
}));

import { moderationService } from '@/modules/moderation/moderation.service';
import { moderationRepository } from '@/modules/moderation/moderation.repository';
import { pushService } from '@/shared/push/push.service';

const REPORTER = '123e4567-e89b-12d3-a456-426614174000';
const ADMIN = '223e4567-e89b-12d3-a456-426614174000';
const POST = '323e4567-e89b-12d3-a456-426614174000';

// O aviso sai com `void`, fora do fluxo da resposta: espera a fila de
// microtarefas esvaziar antes de olhar se o push foi chamado.
const esperarAviso = () => new Promise((r) => setTimeout(r, 0));

describe('moderationService.report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(moderationRepository.listAdminIds).mockResolvedValue([ADMIN]);
    vi.mocked(moderationRepository.describeTarget).mockResolvedValue({
      rotulo: 'publicação de @fulano',
      url: `/app/user-posts/fulano?postId=${POST}`,
    });
  });

  it('avisa quem modera quando a denúncia é nova', async () => {
    vi.mocked(moderationRepository.createReport).mockResolvedValue(true);

    await moderationService.report(REPORTER, { postId: POST, reason: 'assedio' });
    await esperarAviso();

    expect(pushService.sendToUser).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({
        title: 'Nova denúncia',
        body: 'Assédio ou ofensa · publicação de @fulano',
        url: `/app/user-posts/fulano?postId=${POST}`,
      })
    );
  });

  it('não avisa de novo quando a mesma pessoa repete a denúncia', async () => {
    vi.mocked(moderationRepository.createReport).mockResolvedValue(false);

    await moderationService.report(REPORTER, { postId: POST, reason: 'assedio' });
    await esperarAviso();

    expect(pushService.sendToUser).not.toHaveBeenCalled();
  });

  it('registra a denúncia mesmo quando o aviso falha', async () => {
    vi.mocked(moderationRepository.createReport).mockResolvedValue(true);
    vi.mocked(moderationRepository.listAdminIds).mockRejectedValue(new Error('banco fora'));

    await expect(
      moderationService.report(REPORTER, { postId: POST, reason: 'spam' })
    ).resolves.toEqual({ message: 'Denúncia registrada. Obrigado por avisar.' });
  });
});
