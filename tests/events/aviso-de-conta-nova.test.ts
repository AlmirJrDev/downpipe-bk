import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/modules/profiles/profiles.repository', () => ({
  profilesRepository: { findById: vi.fn() },
}));
vi.mock('@/modules/moderation/moderation.repository', () => ({
  moderationRepository: { listAdminIds: vi.fn() },
}));
vi.mock('@/modules/notifications/notifications.repository', () => ({
  notificationsRepository: { countUnread: vi.fn(async () => 0) },
}));
vi.mock('@/shared/push/push.service', () => ({ pushService: { sendToUser: vi.fn() } }));

import { avisarSeContaNova } from '@/modules/events/aviso-de-conta-nova';
import { profilesRepository } from '@/modules/profiles/profiles.repository';
import { moderationRepository } from '@/modules/moderation/moderation.repository';
import { pushService } from '@/shared/push/push.service';

const AGORA = Date.parse('2026-09-30T12:00:00Z');
const ROLE = { id: 'e1', nome: 'Encontro da Marginal', cidade: 'Campinas' };

const contaCriadaHa = (horas: number) =>
  ({ id: 'u1', created_at: new Date(AGORA - horas * 3_600_000).toISOString() }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(moderationRepository.listAdminIds).mockResolvedValue(['admin']);
});

describe('aviso de rolê de conta nova', () => {
  it('conta de uma hora publicando: quem modera é avisado, com o link do rolê', async () => {
    vi.mocked(profilesRepository.findById).mockResolvedValue(contaCriadaHa(1));

    await avisarSeContaNova('u1', ROLE, AGORA);

    expect(pushService.sendToUser).toHaveBeenCalledWith('admin', {
      title: 'Rolê novo de conta nova',
      body: 'Encontro da Marginal · Campinas',
      url: '/app/event/e1',
      badge: 0,
    });
  });

  it('conta com mais de um dia não avisa — viraria ruído a cada rolê', async () => {
    vi.mocked(profilesRepository.findById).mockResolvedValue(contaCriadaHa(30));

    await avisarSeContaNova('u1', ROLE, AGORA);

    expect(pushService.sendToUser).not.toHaveBeenCalled();
  });

  it('quem modera e publica o próprio rolê não recebe o próprio aviso', async () => {
    vi.mocked(profilesRepository.findById).mockResolvedValue(contaCriadaHa(1));
    vi.mocked(moderationRepository.listAdminIds).mockResolvedValue(['u1']);

    await avisarSeContaNova('u1', ROLE, AGORA);

    expect(pushService.sendToUser).not.toHaveBeenCalled();
  });

  it('falha no aviso nunca vira falha da publicação', async () => {
    vi.mocked(profilesRepository.findById).mockRejectedValue(new Error('banco fora'));

    await expect(avisarSeContaNova('u1', ROLE, AGORA)).resolves.toBeUndefined();
  });
});
