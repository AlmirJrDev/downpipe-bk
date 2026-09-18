import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/modules/events/events.repository', () => ({
  eventsRepository: { findById: vi.fn() },
}));

vi.mock('@/modules/event-chat/event-chat.repository', () => ({
  eventChatRepository: {
    participantIds: vi.fn(),
    isAttendee: vi.fn(),
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    markRead: vi.fn(),
    reads: vi.fn(),
    markPushed: vi.fn(),
    countUnread: vi.fn(),
    removedSince: vi.fn(),
  },
}));

vi.mock('@/modules/moderation/moderation.repository', () => ({
  moderationRepository: { listHiddenIds: vi.fn() },
}));

vi.mock('@/modules/notifications/notifications.repository', () => ({
  notificationsRepository: { countUnread: vi.fn() },
}));

vi.mock('@/shared/push/push.service', () => ({
  pushService: { sendToUser: vi.fn() },
}));

import { eventChatService } from '@/modules/event-chat/event-chat.service';
import { eventsRepository } from '@/modules/events/events.repository';
import { eventChatRepository } from '@/modules/event-chat/event-chat.repository';
import { moderationRepository } from '@/modules/moderation/moderation.repository';
import { pushService } from '@/shared/push/push.service';

const EVENTO = '11111111-1111-4111-8111-111111111111';
const ORGANIZADOR = '22222222-2222-4222-8222-222222222222';
const ANA = '33333333-3333-4333-8333-333333333333';
const BETO = '44444444-4444-4444-8444-444444444444';
const ESTRANHO = '55555555-5555-4555-8555-555555555555';

const DAQUI_A_UMA_SEMANA = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const ONTEM = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

function evento(startsAt = DAQUI_A_UMA_SEMANA) {
  return { id: EVENTO, organizer_id: ORGANIZADOR, name: 'Rolê de teste', starts_at: startsAt } as never;
}

function mensagem(autor: string | null, texto = 'bora') {
  return {
    id: 'm-' + Math.random(),
    event_id: EVENTO,
    author_id: autor,
    kind: autor ? 'mensagem' : 'sistema',
    text: texto,
    created_at: new Date().toISOString(),
    profiles: autor ? { username: 'ana', display_name: 'Ana', avatar_url: null } : null,
  } as never;
}

const esperarAviso = () => new Promise((r) => setTimeout(r, 0));
const avisados = () => vi.mocked(pushService.sendToUser).mock.calls.map(([id]) => id);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(eventsRepository.findById).mockResolvedValue(evento());
  vi.mocked(eventChatRepository.participantIds).mockResolvedValue([ORGANIZADOR, ANA, BETO]);
  vi.mocked(eventChatRepository.isAttendee).mockImplementation(async (_e, id) => id === ANA || id === BETO);
  vi.mocked(eventChatRepository.reads).mockResolvedValue([]);
  vi.mocked(eventChatRepository.list).mockResolvedValue([]);
  vi.mocked(moderationRepository.listHiddenIds).mockResolvedValue([]);
});

describe('quem entra no chat', () => {
  it('recusa quem não confirmou presença', async () => {
    await expect(eventChatService.list(EVENTO, ESTRANHO, {})).rejects.toMatchObject({
      statusCode: 403,
      code: 'CHAT_SO_CONFIRMADOS',
    });
    await expect(eventChatService.send(EVENTO, ESTRANHO, 'oi')).rejects.toMatchObject({ statusCode: 403 });
    expect(eventChatRepository.create).not.toHaveBeenCalled();
  });

  it('deixa o organizador entrar mesmo sem confirmar presença', async () => {
    const r = await eventChatService.list(EVENTO, ORGANIZADOR, {});
    expect(r.isOrganizer).toBe(true);
  });

  it('esconde mensagens de quem a pessoa bloqueou', async () => {
    vi.mocked(eventChatRepository.list).mockResolvedValue([mensagem(ANA), mensagem(BETO)]);
    vi.mocked(moderationRepository.listHiddenIds).mockResolvedValue([BETO]);

    const r = await eventChatService.list(EVENTO, ORGANIZADOR, {});
    expect(r.messages.map((m) => m.author?.id)).toEqual([ANA]);
  });

  it('para quem não participa, o contador vem nulo em vez de erro', async () => {
    await expect(eventChatService.unread(EVENTO, ESTRANHO)).resolves.toBeNull();
  });
});

describe('push das mensagens', () => {
  it('avisa todo mundo menos quem escreveu', async () => {
    vi.mocked(eventChatRepository.create).mockResolvedValue(mensagem(ANA));

    await eventChatService.send(EVENTO, ANA, 'bora');
    await esperarAviso();

    expect(avisados().sort()).toEqual([ORGANIZADOR, BETO].sort());
  });

  it('não avisa de novo quem já recebeu push e ainda não abriu o chat', async () => {
    vi.mocked(eventChatRepository.create).mockResolvedValue(mensagem(ANA));
    const umaHoraAtras = new Date(Date.now() - 3600_000).toISOString();
    const dezMinAtras = new Date(Date.now() - 600_000).toISOString();
    vi.mocked(eventChatRepository.reads).mockResolvedValue([
      // Beto leu há uma hora e já foi avisado depois disso: está na rajada.
      { user_id: BETO, last_read_at: umaHoraAtras, last_pushed_at: dezMinAtras },
    ]);

    await eventChatService.send(EVENTO, ANA, 'mais uma');
    await esperarAviso();

    expect(avisados()).toEqual([ORGANIZADOR]);
  });

  it('não avisa quem está com o chat aberto agora', async () => {
    vi.mocked(eventChatRepository.create).mockResolvedValue(mensagem(ANA));
    vi.mocked(eventChatRepository.reads).mockResolvedValue([
      { user_id: BETO, last_read_at: new Date().toISOString(), last_pushed_at: null },
    ]);

    await eventChatService.send(EVENTO, ANA, 'oi');
    await esperarAviso();

    expect(avisados()).toEqual([ORGANIZADOR]);
  });

  it('aviso do organizador fura a rajada e chega mesmo pra quem já foi avisado', async () => {
    vi.mocked(eventChatRepository.create).mockResolvedValue(mensagem(ORGANIZADOR, 'atrasou 30 min'));
    const umaHoraAtras = new Date(Date.now() - 3600_000).toISOString();
    vi.mocked(eventChatRepository.reads).mockResolvedValue([
      { user_id: BETO, last_read_at: umaHoraAtras, last_pushed_at: new Date().toISOString() },
    ]);

    await eventChatService.send(EVENTO, ORGANIZADOR, 'atrasou 30 min');
    await esperarAviso();

    expect(avisados().sort()).toEqual([ANA, BETO].sort());
    const corpo = vi.mocked(pushService.sendToUser).mock.calls[0][1].body;
    expect(corpo).toContain('Aviso do organizador');
  });

  it('não manda a mensagem de alguém pra quem bloqueou essa pessoa', async () => {
    vi.mocked(eventChatRepository.create).mockResolvedValue(mensagem(ANA));
    vi.mocked(moderationRepository.listHiddenIds).mockImplementation(async (id) => (id === BETO ? [ANA] : []));

    await eventChatService.send(EVENTO, ANA, 'oi');
    await esperarAviso();

    expect(avisados()).toEqual([ORGANIZADOR]);
  });
});

describe('mensagem apagada some da tela dos outros', () => {
  it('a conferida devolve os ids apagados desde a anterior, e a hora pra próxima', async () => {
    vi.mocked(eventChatRepository.removedSince).mockResolvedValue(['m-apagada']);

    const r = await eventChatService.list(EVENTO, ANA, {
      desde: '2026-09-18T12:00:00Z',
      removidasDesde: '2026-09-18T12:00:00Z',
    });

    expect(eventChatRepository.removedSince).toHaveBeenCalledWith(EVENTO, '2026-09-18T12:00:00Z');
    expect(r.removedIds).toEqual(['m-apagada']);
    expect(Number.isNaN(Date.parse(r.agora))).toBe(false);
  });

  it('sem removidasDesde (primeira carga) nem pergunta o que foi apagado', async () => {
    const r = await eventChatService.list(EVENTO, ANA, {});
    expect(eventChatRepository.removedSince).not.toHaveBeenCalled();
    expect(r.removedIds).toEqual([]);
  });
});

describe('apagar mensagem', () => {
  it('o autor apaga a própria, o organizador apaga qualquer uma, outro não', async () => {
    vi.mocked(eventChatRepository.findById).mockResolvedValue(mensagem(ANA));

    await expect(eventChatService.remove('m1', ANA)).resolves.toBeUndefined();
    await expect(eventChatService.remove('m1', ORGANIZADOR)).resolves.toBeUndefined();
    await expect(eventChatService.remove('m1', BETO)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('cancelamento', () => {
  it('avisa os confirmados, e não o organizador que cancelou', async () => {
    const enviar = await eventChatService.prepararAvisoDeCancelamento(evento());
    await enviar();

    expect(avisados().sort()).toEqual([ANA, BETO].sort());
  });

  it('rolê que já aconteceu não avisa ninguém', async () => {
    const enviar = await eventChatService.prepararAvisoDeCancelamento(evento(ONTEM));
    await enviar();

    expect(pushService.sendToUser).not.toHaveBeenCalled();
    expect(eventChatRepository.participantIds).not.toHaveBeenCalled();
  });
});
