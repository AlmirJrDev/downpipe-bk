import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/modules/events/events.repository', () => ({
  eventsRepository: { paraLembrar: vi.fn(), marcarLembreteEnviado: vi.fn() },
}));

vi.mock('@/modules/event-chat/event-chat.repository', () => ({
  eventChatRepository: { participantIds: vi.fn() },
}));

vi.mock('@/modules/notifications/notifications.repository', () => ({
  notificationsRepository: { countUnread: vi.fn().mockResolvedValue(0) },
}));

vi.mock('@/shared/push/push.service', () => ({ pushService: { sendToUser: vi.fn() } }));

import {
  eventRemindersService,
  quandoPorExtenso,
} from '@/modules/events/event-reminders.service';
import { eventsRepository } from '@/modules/events/events.repository';
import { eventChatRepository } from '@/modules/event-chat/event-chat.repository';
import { pushService } from '@/shared/push/push.service';

const ORGANIZADOR = 'org-1';
const ANA = 'ana-1';
const BETO = 'beto-1';

/** 20/09/2026 às 12:00 em Brasília (UTC-3). */
const AGORA = new Date('2026-09-20T15:00:00Z');

function evento(id: string, startsAt: string) {
  return {
    id,
    organizer_id: ORGANIZADOR,
    name: 'Encontro da Paulista',
    starts_at: startsAt,
    location: 'Posto Shell',
    city: 'São Paulo',
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(eventChatRepository.participantIds).mockResolvedValue([ORGANIZADOR, ANA, BETO]);
  vi.mocked(eventsRepository.paraLembrar).mockResolvedValue([]);
});

describe('como a hora é escrita', () => {
  it('fala como gente: hoje, amanhã ou o dia da semana', () => {
    expect(quandoPorExtenso('2026-09-20T23:00:00Z', AGORA)).toBe('hoje às 20:00');
    expect(quandoPorExtenso('2026-09-21T12:00:00Z', AGORA)).toBe('amanhã às 09:00');
    expect(quandoPorExtenso('2026-09-26T17:00:00Z', AGORA)).toContain('sábado');
  });

  it('rolê de manhã cedo continua sendo "amanhã", não "hoje"', () => {
    // 15h de distância, mas outro dia no calendário de quem lê.
    expect(quandoPorExtenso('2026-09-21T09:00:00Z', AGORA)).toBe('amanhã às 06:00');
  });
});

describe('lembrete do rolê', () => {
  it('avisa todo mundo que vai, inclusive quem organiza', async () => {
    vi.mocked(eventsRepository.paraLembrar).mockResolvedValue([
      evento('e1', '2026-09-21T15:00:00Z'),
    ]);

    const resumo = await eventRemindersService.enviarPendentes(AGORA);

    expect(resumo).toEqual({ roles: 1, avisos: 3 });
    const [, aviso] = vi.mocked(pushService.sendToUser).mock.calls[0];
    expect(aviso.title).toBe('Encontro da Paulista');
    expect(aviso.body).toBe('amanhã às 12:00 · Posto Shell, São Paulo');
    expect(aviso.url).toBe('/app/event/e1');
  });

  it('marca como avisado pra não repetir na rodada seguinte', async () => {
    vi.mocked(eventsRepository.paraLembrar).mockResolvedValue([
      evento('e1', '2026-09-21T15:00:00Z'),
    ]);

    await eventRemindersService.enviarPendentes(AGORA);

    expect(eventsRepository.marcarLembreteEnviado).toHaveBeenCalledWith('e1');
  });

  it('rolê só com o organizador não vira push — ele sabe do próprio rolê', async () => {
    vi.mocked(eventChatRepository.participantIds).mockResolvedValue([ORGANIZADOR]);
    vi.mocked(eventsRepository.paraLembrar).mockResolvedValue([
      evento('e1', '2026-09-21T15:00:00Z'),
    ]);

    const resumo = await eventRemindersService.enviarPendentes(AGORA);

    expect(pushService.sendToUser).not.toHaveBeenCalled();
    expect(resumo.avisos).toBe(0);
    // Mesmo assim sai da fila: reprocessar não mudaria nada.
    expect(eventsRepository.marcarLembreteEnviado).toHaveBeenCalledWith('e1');
  });

  it('um rolê com erro não derruba o lembrete dos outros', async () => {
    vi.mocked(eventsRepository.paraLembrar).mockResolvedValue([
      evento('ruim', '2026-09-21T15:00:00Z'),
      evento('bom', '2026-09-21T16:00:00Z'),
    ]);
    vi.mocked(eventChatRepository.participantIds).mockImplementation(async (id) => {
      if (id === 'ruim') throw new Error('banco fora');
      return [ORGANIZADOR, ANA];
    });

    const resumo = await eventRemindersService.enviarPendentes(AGORA);

    expect(resumo.avisos).toBe(2);
    expect(eventsRepository.marcarLembreteEnviado).toHaveBeenCalledWith('bom');
    // O que falhou continua sem marca: tenta de novo na próxima rodada.
    expect(eventsRepository.marcarLembreteEnviado).not.toHaveBeenCalledWith('ruim');
  });

  it('pede só os rolês dentro da janela de antecedência', async () => {
    await eventRemindersService.enviarPendentes(AGORA);

    const [ate] = vi.mocked(eventsRepository.paraLembrar).mock.calls[0];
    const horas = (Date.parse(ate) - AGORA.getTime()) / 3600_000;
    expect(horas).toBe(20);
  });
});
