import { AppError } from '@/shared/utils/AppError';
import { assertCarOwnership } from '@/modules/cars/cars.service';
import { carAggregatesService } from '@/modules/cars/car-aggregates.service';
import { projectsRepository } from '@/modules/projects/projects.repository';
import { projectStepsRepository, ProjectStepRow } from './project-steps.repository';
import { CreateStepInput, UpdateStepInput } from './project-steps.schema';

function toPublicStep(row: ProjectStepRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    carId: row.car_id,
    name: row.name,
    status: row.status,
    estimatedCost: row.estimated_cost,
    actualCost: row.actual_cost,
    date: row.date,
    description: row.description,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findProjectOrThrow(projectId: string) {
  const project = await projectsRepository.findById(projectId);
  if (!project) {
    throw AppError.notFound('PROJECT_NOT_FOUND', 'Projeto não encontrado');
  }
  return project;
}

async function findStepOrThrow(projectId: string, stepId: string): Promise<ProjectStepRow> {
  const step = await projectStepsRepository.findById(stepId);

  if (!step || step.project_id !== projectId) {
    throw AppError.notFound('PROJECT_STEP_NOT_FOUND', 'Etapa do projeto não encontrada');
  }

  return step;
}

export const projectStepsService = {
  async list(projectId: string) {
    await findProjectOrThrow(projectId);
    const steps = await projectStepsRepository.listByProject(projectId);
    return steps.map(toPublicStep);
  },

  async create(projectId: string, userId: string, input: CreateStepInput) {
    const project = await findProjectOrThrow(projectId);
    await assertCarOwnership(project.car_id, userId);

    const position = input.position ?? (await projectStepsRepository.getNextPosition(projectId));

    const step = await projectStepsRepository.create(projectId, project.car_id, input, position);

    await carAggregatesService.recalculate(project.car_id);

    return toPublicStep(step);
  },

  async update(projectId: string, stepId: string, userId: string, input: UpdateStepInput) {
    const project = await findProjectOrThrow(projectId);
    await assertCarOwnership(project.car_id, userId);
    await findStepOrThrow(projectId, stepId);

    const updated = await projectStepsRepository.update(stepId, input);

    await carAggregatesService.recalculate(project.car_id);

    return toPublicStep(updated);
  },

  async remove(projectId: string, stepId: string, userId: string) {
    const project = await findProjectOrThrow(projectId);
    await assertCarOwnership(project.car_id, userId);
    await findStepOrThrow(projectId, stepId);

    await projectStepsRepository.delete(stepId);

    await carAggregatesService.recalculate(project.car_id);
  },
};
