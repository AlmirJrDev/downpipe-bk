import { AppError } from '@/shared/utils/AppError';
import { assertCarOwnership } from '@/modules/cars/cars.service';
import { carAggregatesService } from '@/modules/cars/car-aggregates.service';
import { modificationsRepository, ModificationRow } from './modifications.repository';
import { CreateModificationInput, UpdateModificationInput } from './modifications.schema';

function toPublicModification(row: ModificationRow) {
  return {
    id: row.id,
    carId: row.car_id,
    name: row.name,
    category: row.category,
    cost: row.cost,
    date: row.date,
    icon: row.icon,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findOwnedModificationById(id: string, userId: string): Promise<ModificationRow> {
  const modification = await modificationsRepository.findById(id);

  if (!modification) {
    throw AppError.notFound('MODIFICATION_NOT_FOUND', 'Modificação não encontrada');
  }

  await assertCarOwnership(modification.car_id, userId);

  return modification;
}

export const modificationsService = {
  async listByCar(carId: string) {
    const modifications = await modificationsRepository.listByCar(carId);
    return modifications.map(toPublicModification);
  },

  async create(carId: string, userId: string, input: CreateModificationInput) {
    await assertCarOwnership(carId, userId);

    const modification = await modificationsRepository.create(carId, input);

    await carAggregatesService.recalculate(carId);

    return toPublicModification(modification);
  },

  async update(id: string, userId: string, input: UpdateModificationInput) {
    const modification = await findOwnedModificationById(id, userId);

    const updated = await modificationsRepository.update(id, input);

    await carAggregatesService.recalculate(modification.car_id);

    return toPublicModification(updated);
  },

  async remove(id: string, userId: string) {
    const modification = await findOwnedModificationById(id, userId);

    await modificationsRepository.delete(id);

    await carAggregatesService.recalculate(modification.car_id);
  },
};
