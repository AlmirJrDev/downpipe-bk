import { AppError } from '@/shared/utils/AppError';
import { assertCarOwnership } from '@/modules/cars/cars.service';
import { carAggregatesService } from '@/modules/cars/car-aggregates.service';
import { projectsRepository, ProjectRow } from './projects.repository';
import { CreateProjectInput, UpdateProjectInput } from './projects.schema';

function toPublicProject(row: ProjectRow) {
  return {
    id: row.id,
    carId: row.car_id,
    title: row.title,
    powerGoalFrom: row.power_goal_from,
    powerGoalTo: row.power_goal_to,
    budgetTotal: row.budget_total,
    budgetSpent: row.budget_spent,
    modificationsTotal: row.modifications_total,
    modificationsDone: row.modifications_done,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findOwnedProjectById(id: string, userId: string): Promise<ProjectRow> {
  const project = await projectsRepository.findById(id);

  if (!project) {
    throw AppError.notFound('PROJECT_NOT_FOUND', 'Projeto não encontrado');
  }

  await assertCarOwnership(project.car_id, userId);

  return project;
}

export const projectsService = {
  async getByCarId(carId: string) {
    const project = await projectsRepository.findByCarId(carId);

    if (!project) {
      throw AppError.notFound('PROJECT_NOT_FOUND', 'Este carro ainda não possui um projeto');
    }

    return toPublicProject(project);
  },

  async create(carId: string, userId: string, input: CreateProjectInput) {
    await assertCarOwnership(carId, userId);

    const existing = await projectsRepository.findByCarId(carId);
    if (existing) {
      throw AppError.conflict('PROJECT_ALREADY_EXISTS', 'Este carro já possui um projeto');
    }

    const project = await projectsRepository.create(carId, input);
    return toPublicProject(project);
  },

  async update(id: string, userId: string, input: UpdateProjectInput) {
    await findOwnedProjectById(id, userId);
    const updated = await projectsRepository.update(id, input);
    return toPublicProject(updated);
  },

  async remove(id: string, userId: string) {
    const project = await findOwnedProjectById(id, userId);
    await projectsRepository.delete(id);
    // project_steps são removidas em cascata pelo banco; recalcula os
    // agregados do carro (volta a zero, exceto por modifications avulsas).
    await carAggregatesService.recalculate(project.car_id);
  },
};
