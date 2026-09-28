import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/modules/moderation/moderation.repository', () => ({
  moderationRepository: {
    listReports: vi.fn(),
    describeTarget: vi.fn(),
    textOfComment: vi.fn(),
    textOfMessage: vi.fn(),
    reviewReport: vi.fn(),
    reviewReportsOfMessage: vi.fn(),
    mediaUrlsOfPost: vi.fn(),
    deletePost: vi.fn(),
    deleteComment: vi.fn(),
    softDeleteMessage: vi.fn(),
    findEvent: vi.fn(),
    deleteEvent: vi.fn(),
    rejeitarSugestaoDoEvento: vi.fn(),
    isAdmin: vi.fn(),
    countOpenReports: vi.fn(),
  },
}));

vi.mock('@/shared/storage/storage.service', () => ({
  storageService: { extractPathFromPublicUrl: vi.fn(() => 'pasta/foto.jpg'), deleteImage: vi.fn() },
}));

vi.mock('@/modules/follows/follows.repository', () => ({ followsRepository: { delete: vi.fn() } }));
vi.mock('@/modules/profiles/profiles.repository', () => ({ profilesRepository: { findById: vi.fn() } }));
vi.mock('@/modules/notifications/notifications.repository', () => ({
  notificationsRepository: { countUnread: vi.fn() },
}));
vi.mock('@/shared/push/push.service', () => ({ pushService: { sendToUser: vi.fn() } }));
vi.mock('@/modules/event-chat/event-chat.service', () => ({
  eventChatService: { prepararAvisoDeCancelamento: vi.fn(async () => async () => undefined) },
}));

import { moderationService } from '@/modules/moderation/moderation.service';
import { eventChatService } from '@/modules/event-chat/event-chat.service';
import { moderationRepository } from '@/modules/moderation/moderation.repository';
import { storageService } from '@/shared/storage/storage.service';

const COMENTARIO = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(moderationRepository.describeTarget).mockResolvedValue({
    rotulo: 'comentário de @ana',
    url: '/app/user-posts/ana?postId=1',
  });
});

describe('fila de denúncias', () => {
  it('entrega o que a decisão precisa: motivo por extenso, quem denunciou e o texto do alvo', async () => {
    vi.mocked(moderationRepository.listReports).mockResolvedValue([
      {
        id: 'd1',
        reason: 'assedio',
        details: 'xingou todo mundo',
        status: 'open',
        created_at: '2026-09-20T12:00:00Z',
        post_id: null,
        comment_id: COMENTARIO,
        profile_id: null,
        message_id: null,
        profiles: { username: 'beto' },
      },
    ] as never);
    vi.mocked(moderationRepository.textOfComment).mockResolvedValue('texto denunciado');

    const [denuncia] = await moderationService.fila('open');

    expect(denuncia.reasonLabel).toBe('Assédio ou ofensa');
    expect(denuncia.reporter).toBe('beto');
    expect(denuncia.target).toMatchObject({
      tipo: 'comentario',
      id: COMENTARIO,
      texto: 'texto denunciado',
      rotulo: 'comentário de @ana',
    });
  });
});

describe('apagar conteúdo denunciado', () => {
  it('post: tira as fotos do Storage antes de apagar a linha', async () => {
    vi.mocked(moderationRepository.mediaUrlsOfPost).mockResolvedValue(['https://exemplo/foto.jpg']);
    vi.mocked(moderationRepository.deletePost).mockResolvedValue(true);

    await moderationService.apagarConteudo('post', 'p1');

    expect(storageService.deleteImage).toHaveBeenCalled();
    const ordemDoDelete = vi.mocked(moderationRepository.deletePost).mock.invocationCallOrder[0];
    const ordemDaFoto = vi.mocked(storageService.deleteImage).mock.invocationCallOrder[0];
    expect(ordemDaFoto).toBeLessThan(ordemDoDelete);
  });

  it('mensagem: só marca como apagada e já revisa as denúncias dela', async () => {
    vi.mocked(moderationRepository.softDeleteMessage).mockResolvedValue(true);

    await moderationService.apagarConteudo('mensagem', 'm1');

    expect(moderationRepository.reviewReportsOfMessage).toHaveBeenCalledWith('m1');
  });

  it('alvo que já sumiu vira 404, não erro de banco', async () => {
    vi.mocked(moderationRepository.deleteComment).mockResolvedValue(false);

    await expect(moderationService.apagarConteudo('comentario', 'c1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('apagar um rolê denunciado', () => {
  const EVENTO = { id: 'e1', name: 'Encontro fantasma', starts_at: '2026-12-01T22:00:00.000Z' };

  it('avisa quem confirmou ANTES de apagar — depois a lista some em cascata', async () => {
    vi.mocked(moderationRepository.findEvent).mockResolvedValue(EVENTO as never);
    vi.mocked(moderationRepository.deleteEvent).mockResolvedValue(true);

    await moderationService.apagarConteudo('evento', 'e1');

    const ordemDoAviso = vi.mocked(eventChatService.prepararAvisoDeCancelamento).mock
      .invocationCallOrder[0];
    const ordemDoDelete = vi.mocked(moderationRepository.deleteEvent).mock.invocationCallOrder[0];
    expect(ordemDoAviso).toBeLessThan(ordemDoDelete);
  });

  it('o aviso não diz "cancelado pelo organizador" — não foi ele quem tirou', async () => {
    vi.mocked(moderationRepository.findEvent).mockResolvedValue(EVENTO as never);
    vi.mocked(moderationRepository.deleteEvent).mockResolvedValue(true);

    await moderationService.apagarConteudo('evento', 'e1');

    const [, motivo] = vi.mocked(eventChatService.prepararAvisoDeCancelamento).mock.calls[0];
    expect(motivo).not.toContain('organizador');
  });

  /**
   * A ordem aqui é o bug: events.id em event_suggestions é "on delete set
   * null", então depois do delete não existe mais linha com esse event_id
   * pra marcar. O ensaio em produção pegou a sugestão presa em "approved"
   * apontando pra um rolê que não existia mais.
   */
  it('marca a sugestão ANTES de apagar — depois o vínculo já virou null', async () => {
    vi.mocked(moderationRepository.findEvent).mockResolvedValue(EVENTO as never);
    vi.mocked(moderationRepository.deleteEvent).mockResolvedValue(true);

    await moderationService.apagarConteudo('evento', 'e1');

    expect(moderationRepository.rejeitarSugestaoDoEvento).toHaveBeenCalledWith('e1');
    const ordemDaMarca = vi.mocked(moderationRepository.rejeitarSugestaoDoEvento).mock
      .invocationCallOrder[0];
    const ordemDoDelete = vi.mocked(moderationRepository.deleteEvent).mock.invocationCallOrder[0];
    expect(ordemDaMarca).toBeLessThan(ordemDoDelete);
  });

  it('rolê que já sumiu vira 404, e nada é apagado', async () => {
    vi.mocked(moderationRepository.findEvent).mockResolvedValue(null as never);

    await expect(moderationService.apagarConteudo('evento', 'e1')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(moderationRepository.deleteEvent).not.toHaveBeenCalled();
  });
});
