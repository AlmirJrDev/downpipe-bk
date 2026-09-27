import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/modules/cars/cars.repository', async () => {
  const real = await vi.importActual<typeof import('@/modules/cars/cars.repository')>(
    '@/modules/cars/cars.repository'
  );
  return {
    ...real,
    carsRepository: { list: vi.fn(), findById: vi.fn(), likesPorCarro: vi.fn() },
    countEventsForCar: vi.fn().mockResolvedValue(0),
  };
});

vi.mock('@/modules/profiles/profiles.repository', () => ({
  profilesRepository: { findByUsername: vi.fn() },
}));

vi.mock('@/shared/storage/storage.service', () => ({ storageService: {} }));
vi.mock('@/modules/vehicle-catalog/vehicle-catalog.repository', () => ({
  vehicleCatalogRepository: { findVersionById: vi.fn() },
}));

import { carsService } from '@/modules/cars/cars.service';
import { carsRepository } from '@/modules/cars/cars.repository';

const carro = (id: string) =>
  ({
    id,
    owner_id: 'u1',
    version: 'Civic',
    status: 'building',
    project_progress: 0,
    amount_invested: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    profiles: null,
    vehicle_versions: null,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('curtidas das fotos do carro', () => {
  it('a listagem pede as curtidas de todos os carros de uma vez, não uma por card', async () => {
    vi.mocked(carsRepository.list).mockResolvedValue({ rows: [carro('a'), carro('b')], total: 2 });
    vi.mocked(carsRepository.likesPorCarro).mockResolvedValue(new Map([['a', 17]]));

    const { cars } = await carsService.list({}, { page: 1, limit: 20, offset: 0 });

    expect(carsRepository.likesPorCarro).toHaveBeenCalledTimes(1);
    expect(carsRepository.likesPorCarro).toHaveBeenCalledWith(['a', 'b']);
    expect(cars[0].photosLikes).toBe(17);
    // Carro sem foto curtida não vem na view — vira zero, e não undefined.
    expect(cars[1].photosLikes).toBe(0);
  });

  it('o detalhe do carro também traz o número', async () => {
    vi.mocked(carsRepository.findById).mockResolvedValue(carro('a'));
    vi.mocked(carsRepository.likesPorCarro).mockResolvedValue(new Map([['a', 5]]));

    const car = await carsService.getById('a');

    expect(car.photosLikes).toBe(5);
  });
});
