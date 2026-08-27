import { AppError } from '@/shared/utils/AppError';
import { carsRepository } from './cars.repository';
import { modificationsRepository } from '@/modules/modifications/modifications.repository';
import { projectsRepository } from '@/modules/projects/projects.repository';

function monthKey(dateStr: string): string {
  // dateStr no formato YYYY-MM-DD -> retorna YYYY-MM
  return dateStr.slice(0, 7);
}

export const carStatisticsService = {
  async getByCarId(carId: string) {
    const car = await carsRepository.findById(carId);
    if (!car) {
      throw AppError.notFound('CAR_NOT_FOUND', 'Carro não encontrado');
    }

    const [modifications, project] = await Promise.all([
      modificationsRepository.listByCar(carId),
      projectsRepository.findByCarId(carId),
    ]);

    const spendingByCategory: Record<string, number> = {};
    const spendingByMonth: Record<string, number> = {};

    for (const mod of modifications) {
      const cost = Number(mod.cost ?? 0);
      const category = mod.category ?? 'Other';
      spendingByCategory[category] = (spendingByCategory[category] ?? 0) + cost;

      if (mod.date) {
        const key = monthKey(mod.date);
        spendingByMonth[key] = (spendingByMonth[key] ?? 0) + cost;
      }
    }

    const totalModificationsCost = modifications.reduce(
      (sum, mod) => sum + Number(mod.cost ?? 0),
      0
    );

    return {
      totalInvested: car.amount_invested,
      totalModifications: modifications.length,
      spendingByCategory: Object.entries(spendingByCategory).map(([category, amount]) => ({
        category,
        amount,
      })),
      spendingByMonth: Object.entries(spendingByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount })),
      projectProgress: car.project_progress,
      currentPower: car.power,
      targetPower: project
        ? { from: project.power_goal_from, to: project.power_goal_to }
        : null,
      // custo total registrado apenas nas modificações avulsas (sem contar
      // as etapas do projeto, já refletidas em budgetSpent do projeto).
      totalModificationsCost,
      budgetSpent: project?.budget_spent ?? 0,
      budgetTotal: project?.budget_total ?? null,
    };
  },
};
