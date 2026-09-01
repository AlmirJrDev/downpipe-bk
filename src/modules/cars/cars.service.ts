import { AppError } from '@/shared/utils/AppError';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';
import { storageService } from '@/shared/storage/storage.service';
import { STORAGE_BUCKETS } from '@/shared/storage/storage.constants';
import { profilesRepository } from '@/modules/profiles/profiles.repository';
import { vehicleCatalogRepository } from '@/modules/vehicle-catalog/vehicle-catalog.repository';
import { carsRepository, CarRow, countEventsForCar } from './cars.repository';
import { CreateCarInput, UpdateCarInput, ListCarsQuery } from './cars.schema';

export function toPublicCar(row: CarRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    vehicleVersionId: row.vehicle_version_id,
    version: row.version,
    engine: row.engine,
    power: row.power,
    torque: row.torque,
    transmission: row.transmission,
    drivetrain: row.drivetrain,
    mileage: row.mileage,
    description: row.description,
    photoUrl: row.photo_url,
    status: row.status,
    projectProgress: row.project_progress,
    amountInvested: row.amount_invested,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Dono embutido: sem isso o app não teria como mostrar de quem é o carro
    // na Explorar sem uma requisição por card (N+1).
    owner: row.profiles
      ? {
          id: row.profiles.id,
          username: row.profiles.username,
          displayName: row.profiles.display_name,
          avatarUrl: row.profiles.avatar_url,
        }
      : null,
    // null quando o carro não está linkado ao catálogo (vehicleVersionId
    // null) — é o único jeito do client mostrar marca/modelo/ano sem um
    // request a mais por carro.
    vehicle: row.vehicle_versions
      ? {
          id: row.vehicle_versions.id,
          name: row.vehicle_versions.name,
          year: row.vehicle_versions.year,
          model: {
            id: row.vehicle_versions.vehicle_models.id,
            name: row.vehicle_versions.vehicle_models.name,
          },
          brand: {
            id: row.vehicle_versions.vehicle_models.vehicle_brands.id,
            name: row.vehicle_versions.vehicle_models.vehicle_brands.name,
          },
        }
      : null,
  };
}

export async function assertCarOwnership(carId: string, userId: string): Promise<CarRow> {
  const car = await carsRepository.findById(carId);

  if (!car) {
    throw AppError.notFound('CAR_NOT_FOUND', 'Carro não encontrado');
  }

  if (car.owner_id !== userId) {
    throw AppError.forbidden('Você só pode gerenciar os seus próprios carros');
  }

  return car;
}

export const carsService = {
  async list(filters: ListCarsQuery, pagination: PaginationParams) {
    const { rows, total } = await carsRepository.list(filters, pagination);
    return { cars: rows.map(toPublicCar), total };
  },

  async listByUsername(username: string, pagination: PaginationParams) {
    const profile = await profilesRepository.findByUsername(username);

    if (!profile) {
      throw AppError.notFound('PROFILE_NOT_FOUND', 'Perfil não encontrado');
    }

    const { rows, total } = await carsRepository.list({ ownerId: profile.id }, pagination);
    return { cars: rows.map(toPublicCar), total };
  },

  async getById(id: string) {
    const car = await carsRepository.findById(id);

    if (!car) {
      throw AppError.notFound("CAR_NOT_FOUND", "Carro não encontrado");
    }

    // Só no detalhe: na listagem seria uma consulta por card (N+1), e o
    // número não aparece lá.
    const eventsCount = await countEventsForCar(id);

    return { ...toPublicCar(car), eventsCount };
  },

  async create(ownerId: string, input: CreateCarInput) {
    if (input.vehicleVersionId) {
      const version = await vehicleCatalogRepository.findVersionById(input.vehicleVersionId);
      if (!version) {
        throw AppError.notFound(
          'VEHICLE_VERSION_NOT_FOUND',
          'Versão de veículo do catálogo não encontrada'
        );
      }
    }

    const car = await carsRepository.create(ownerId, input);
    return toPublicCar(car);
  },

  async update(id: string, userId: string, input: UpdateCarInput) {
    await assertCarOwnership(id, userId);

    if (input.vehicleVersionId) {
      const version = await vehicleCatalogRepository.findVersionById(input.vehicleVersionId);
      if (!version) {
        throw AppError.notFound(
          'VEHICLE_VERSION_NOT_FOUND',
          'Versão de veículo do catálogo não encontrada'
        );
      }
    }

    const car = await carsRepository.update(id, input);
    return toPublicCar(car);
  },

  async remove(id: string, userId: string) {
    await assertCarOwnership(id, userId);
    await carsRepository.delete(id);
  },

  async uploadPhoto(id: string, userId: string, file: { buffer: Buffer; mimetype: string }) {
    const existingCar = await assertCarOwnership(id, userId);

    const { publicUrl, path } = await storageService.uploadImage({
      bucket: STORAGE_BUCKETS.CARS,
      userId,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });

    const updated = await carsRepository.updatePhoto(id, publicUrl);

    // Remove a foto antiga (best-effort) para não acumular arquivos órfãos.
    if (existingCar.photo_url) {
      const oldPath = storageService.extractPathFromPublicUrl(
        STORAGE_BUCKETS.CARS,
        existingCar.photo_url
      );
      if (oldPath && oldPath !== path) {
        await storageService.deleteImage(STORAGE_BUCKETS.CARS, oldPath);
      }
    }

    return toPublicCar(updated);
  },
};
