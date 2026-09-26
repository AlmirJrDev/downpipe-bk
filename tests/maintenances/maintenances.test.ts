import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/modules/maintenances/maintenances.repository', () => ({
  maintenancesRepository: {
    listByCar: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    pendentes: vi.fn(),
    marcarAvisada: vi.fn(),
  },
}));

vi.mock('@/modules/cars/cars.service', () => ({ assertCarOwnership: vi.fn() }));
vi.mock('@/modules/notifications/notifications.repository', () => ({
  notificationsRepository: { countUnread: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/shared/push/push.service', () => ({ pushService: { sendToUser: vi.fn() } }));

import { calcularProxima, maintenancesService } from '@/modules/maintenances/maintenances.service';
import { maintenanceRemindersService } from '@/modules/maintenances/maintenance-reminders.service';
import { maintenancesRepository } from '@/modules/maintenances/maintenances.repository';
import { assertCarOwnership } from '@/modules/cars/cars.service';
import { pushService } from '@/shared/push/push.service';

/** 20/09/2026, meio-dia. */
const HOJE = new Date('2026-09-20T15:00:00Z');

const oleo = (extra: Record<string, unknown> = {}) => ({
  done_at: '2026-03-20',
  odometer: 40_000,
  interval_km: 10_000,
  interval_months: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(assertCarOwnership).mockResolvedValue({ id: 'c1', owner_id: 'u1', mileage: 45_000 } as never);
});

describe('quando a manutenção vence', () => {
  it('conta por quilometragem quando o carro tem km', () => {
    const p = calcularProxima(oleo(), 45_000, HOJE);
    expect(p.emKm).toBe(50_000);
    expect(p.faltamKm).toBe(5_000);
    expect(p.vencida).toBe(false);
    expect(p.resumo).toBe('faltam 5.000 km');
  });

  it('marca como vencida quando o carro já passou do limite', () => {
    const p = calcularProxima(oleo(), 51_200, HOJE);
    expect(p.vencida).toBe(true);
    expect(p.resumo).toBe('passou 1.200 km do prazo');
  });

  it('avisa que está perto pouco antes do limite', () => {
    const p = calcularProxima(oleo(), 49_700, HOJE);
    expect(p.perto).toBe(true);
    expect(p.vencida).toBe(false);
  });

  it('conta por tempo quando o intervalo é em meses', () => {
    const p = calcularProxima(
      { done_at: '2026-09-10', odometer: null, interval_km: null, interval_months: 1 },
      null,
      HOJE
    );
    expect(p.emData).toBe('2026-10-10');
    expect(p.faltamDias).toBe(20);
    expect(p.resumo).toBe('faltam 20 dias');
  });

  it('mês somado não escorrega pro mês seguinte (31/01 + 1 mês)', () => {
    const p = calcularProxima(
      { done_at: '2026-01-31', odometer: null, interval_km: null, interval_months: 1 },
      null,
      HOJE
    );
    expect(p.emData).toBe('2026-02-28');
  });

  it('vale o que chegar primeiro: km ok, mas o tempo estourou', () => {
    const p = calcularProxima(
      { done_at: '2025-09-20', odometer: 40_000, interval_km: 10_000, interval_months: 12 },
      41_000,
      HOJE
    );
    expect(p.vencida).toBe(true);
  });

  it('sem intervalo nenhum, é só histórico', () => {
    const p = calcularProxima(
      { done_at: '2026-01-10', odometer: 30_000, interval_km: null, interval_months: null },
      45_000,
      HOJE
    );
    expect(p.vencida).toBe(false);
    expect(p.perto).toBe(false);
    expect(p.resumo).toBeNull();
  });

  it('carro sem quilometragem cai na conta por tempo, sem inventar km', () => {
    const p = calcularProxima(oleo({ interval_months: 6 }), null, HOJE);
    expect(p.faltamKm).toBeNull();
    expect(p.emData).toBe('2026-09-20');
    expect(p.vencida).toBe(true);
  });
});

describe('lista de manutenção', () => {
  it('é do dono: carro alheio nem chega a consultar', async () => {
    vi.mocked(assertCarOwnership).mockRejectedValue(Object.assign(new Error('nope'), { statusCode: 403 }));

    await expect(maintenancesService.listByCar('c1', 'outro')).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(maintenancesRepository.listByCar).not.toHaveBeenCalled();
  });
});

describe('lembrete de manutenção', () => {
  const pendente = (extra: Record<string, unknown> = {}) => ({
    id: 'm1',
    car_id: 'c1',
    kind: 'Troca de óleo',
    ...oleo(),
    notified_at: null,
    cars: { id: 'c1', owner_id: 'u1', version: 'Golf GTI', mileage: 51_000 },
    ...extra,
  });

  it('avisa o dono quando venceu, uma vez só', async () => {
    vi.mocked(maintenancesRepository.pendentes).mockResolvedValue([pendente()] as never);

    const r = await maintenanceRemindersService.enviarPendentes(HOJE);

    expect(r.avisos).toBe(1);
    const [quem, aviso] = vi.mocked(pushService.sendToUser).mock.calls[0];
    expect(quem).toBe('u1');
    expect(aviso.title).toBe('Golf GTI: Troca de óleo');
    expect(aviso.body).toContain('passou 1.000 km');
    expect(aviso.url).toBe('/app/car/c1');
    expect(maintenancesRepository.marcarAvisada).toHaveBeenCalledWith('m1');
  });

  it('item que ainda não venceu continua quieto e na fila', async () => {
    vi.mocked(maintenancesRepository.pendentes).mockResolvedValue([
      pendente({ cars: { id: 'c1', owner_id: 'u1', version: 'Golf GTI', mileage: 44_000 } }),
    ] as never);

    const r = await maintenanceRemindersService.enviarPendentes(HOJE);

    expect(r.avisos).toBe(0);
    expect(pushService.sendToUser).not.toHaveBeenCalled();
    expect(maintenancesRepository.marcarAvisada).not.toHaveBeenCalled();
  });
});
