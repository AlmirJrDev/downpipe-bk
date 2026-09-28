import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/modules/event-suggestions/event-suggestions.repository', () => ({
  eventSuggestionsRepository: {
    create: vi.fn(),
    list: vi.fn(),
    findById: vi.fn(),
    marcar: vi.fn(),
    contarPendentes: vi.fn(),
  },
}));

vi.mock('@/modules/events/events.service', () => ({
  eventsService: { create: vi.fn() },
}));

vi.mock('@/modules/events/events.repository', () => ({
  eventsRepository: { update: vi.fn() },
}));

import { eventSuggestionsService } from '@/modules/event-suggestions/event-suggestions.service';
import { eventSuggestionsRepository } from '@/modules/event-suggestions/event-suggestions.repository';
import { eventsService } from '@/modules/events/events.service';
import { eventsRepository } from '@/modules/events/events.repository';
import { createSuggestionSchema } from '@/modules/event-suggestions/event-suggestions.schema';

const ADMIN = 'admin-1';

const sugestao = (extra: Record<string, unknown> = {}) =>
  ({
    id: 's1',
    name: 'Encontro de Sumaré',
    description: null,
    starts_at: '2026-10-18T12:00:00.000Z',
    ends_at: null,
    ends_at_estimated: false,
    location: 'Posto Graal',
    city: 'Sumaré',
    address: null,
    latitude: null,
    longitude: null,
    entry_note: '1 kg de alimento',
    attractions: ['food_truck'],
    rules: ['sem_borrachao'],
    kind: 'encontro',
    car_categories: [],
    source: 'web',
    source_url: 'https://exemplo.com/post',
    source_note: 'Visto no calendário X',
    organizer_instagram: null,
    suggested_by: null,
    status: 'pending',
    reviewed_at: null,
    event_id: null,
    created_at: '2026-09-28T10:00:00.000Z',
    profiles: null,
    ...extra,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(eventsService.create).mockResolvedValue({ id: 'e1' } as never);
});

describe('sugerir um rolê', () => {
  it('quem sugere recebe a mesma resposta mesmo se alguém já tinha avisado', async () => {
    vi.mocked(eventSuggestionsRepository.create).mockResolvedValue(null);

    const r = await eventSuggestionsService.sugerir(
      { name: 'Encontro de Sumaré' } as never,
      'u1'
    );

    expect(r.message).toContain('Valeu');
  });

  it('a sugestão de usuário fica marcada como tal, com quem mandou', async () => {
    vi.mocked(eventSuggestionsRepository.create).mockResolvedValue(sugestao());

    await eventSuggestionsService.sugerir({ name: 'Encontro' } as never, 'u1');

    const [, origem] = vi.mocked(eventSuggestionsRepository.create).mock.calls[0];
    expect(origem).toEqual({ source: 'usuario', suggestedBy: 'u1' });
  });

  it('só o nome é obrigatório — quem viu um story não sabe o endereço', () => {
    expect(createSuggestionSchema.safeParse({ name: 'Encontro da Paulista' }).success).toBe(true);
    expect(createSuggestionSchema.safeParse({ name: 'ab' }).success).toBe(false);
  });
});

describe('aprovar', () => {
  it('cria o rolê e guarda a fonte junto', async () => {
    vi.mocked(eventSuggestionsRepository.findById).mockResolvedValue(sugestao());

    const r = await eventSuggestionsService.aprovar('s1', ADMIN, {
      startsAt: '2026-10-18T12:00:00.000Z',
      location: 'Posto Graal',
      city: 'Sumaré',
    });

    expect(r).toEqual({ eventId: 'e1' });
    const [organizador, evento] = vi.mocked(eventsService.create).mock.calls[0];
    expect(organizador).toBe(ADMIN);
    expect(evento).toMatchObject({
      name: 'Encontro de Sumaré',
      entryNote: '1 kg de alimento',
      attractions: ['food_truck'],
      rules: ['sem_borrachao'],
    });
    expect(eventsRepository.update).toHaveBeenCalledWith('e1', {
      sourceUrl: 'https://exemplo.com/post',
      sourceNote: 'Visto no calendário X',
    });
    expect(eventSuggestionsRepository.marcar).toHaveBeenCalledWith('s1', 'approved', ADMIN, 'e1');
  });

  it('o @ de quem organiza vai junto: o rolê é dele, não de quem aprovou', async () => {
    vi.mocked(eventSuggestionsRepository.findById).mockResolvedValue(
      sugestao({ organizer_instagram: 'amante_dos_baixos' })
    );

    await eventSuggestionsService.aprovar('s1', ADMIN, {
      startsAt: '2026-10-18T12:00:00.000Z',
      location: 'Posto Graal',
      city: 'Sumaré',
    });

    const [, evento] = vi.mocked(eventsService.create).mock.calls[0];
    expect(evento).toMatchObject({ organizerInstagram: 'amante_dos_baixos' });
  });

  it('a correção de quem aprova ganha da sugestão — data errada é a regra', async () => {
    vi.mocked(eventSuggestionsRepository.findById).mockResolvedValue(sugestao());

    await eventSuggestionsService.aprovar('s1', ADMIN, {
      startsAt: '2026-11-15T13:00:00.000Z',
      location: 'Outro posto',
      city: 'Sumaré',
      name: 'Nome corrigido',
    });

    const [, evento] = vi.mocked(eventsService.create).mock.calls[0];
    expect(evento).toMatchObject({
      name: 'Nome corrigido',
      startsAt: '2026-11-15T13:00:00.000Z',
      location: 'Outro posto',
    });
  });

  it('sugestão já revisada não vira rolê duas vezes', async () => {
    vi.mocked(eventSuggestionsRepository.findById).mockResolvedValue(
      sugestao({ status: 'approved' })
    );

    await expect(
      eventSuggestionsService.aprovar('s1', ADMIN, {
        startsAt: '2026-10-18T12:00:00.000Z',
        location: 'x',
        city: 'y',
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(eventsService.create).not.toHaveBeenCalled();
  });
});

describe('descartar', () => {
  it('marca como rejeitada sem criar nada', async () => {
    vi.mocked(eventSuggestionsRepository.findById).mockResolvedValue(sugestao());

    await eventSuggestionsService.descartar('s1', ADMIN);

    expect(eventsService.create).not.toHaveBeenCalled();
    expect(eventSuggestionsRepository.marcar).toHaveBeenCalledWith('s1', 'rejected', ADMIN);
  });
});
