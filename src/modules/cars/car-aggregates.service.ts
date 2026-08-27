import { supabaseAdmin } from '@/config/supabase';

interface StepForAggregation {
  status: string;
  actual_cost: number | null;
}

interface ModificationForAggregation {
  cost: number | null;
}

export interface CarAggregates {
  budgetSpent: number;
  modificationsTotal: number;
  modificationsDone: number;
  amountInvested: number;
  projectProgress: number;
}

/**
 * Função pura com a matemática do recálculo — isolada do acesso a dados
 * para ser facilmente testável sem precisar mockar o Supabase.
 */
export function computeCarAggregates(
  steps: StepForAggregation[],
  modifications: ModificationForAggregation[]
): CarAggregates {
  const modificationsTotal = steps.length;
  const modificationsDone = steps.filter((step) => step.status === 'done').length;
  const budgetSpent = steps.reduce((sum, step) => sum + Number(step.actual_cost ?? 0), 0);
  const modificationsCost = modifications.reduce((sum, mod) => sum + Number(mod.cost ?? 0), 0);
  const amountInvested = modificationsCost + budgetSpent;
  const projectProgress =
    modificationsTotal > 0 ? Math.round((modificationsDone / modificationsTotal) * 100) : 0;

  return { budgetSpent, modificationsTotal, modificationsDone, amountInvested, projectProgress };
}

/**
 * Recalcula os campos derivados sempre que uma etapa de projeto ou uma
 * modificação é criada/editada/removida. Nunca confiar em valores desses
 * campos vindos do frontend - eles são sempre recomputados aqui a partir
 * da fonte de verdade (project_steps e modifications).
 *
 * Campos recalculados:
 *   - projects.budget_spent          = soma de project_steps.actual_cost
 *   - projects.modifications_total   = quantidade de project_steps
 *   - projects.modifications_done    = quantidade de project_steps com status 'done'
 *   - cars.project_progress          = modifications_done / modifications_total (%)
 *   - cars.amount_invested           = soma de modifications.cost + budget_spent do projeto
 *
 * Implementado na camada de aplicação (não via trigger de banco) para
 * manter a lógica de negócio visível e fácil de testar em TypeScript,
 * conforme a diretriz de evitar complexidade desnecessária no schema.
 */
export const carAggregatesService = {
  async recalculate(carId: string): Promise<void> {
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('car_id', carId)
      .maybeSingle();

    if (projectError) throw projectError;

    let steps: StepForAggregation[] = [];

    if (project) {
      const { data, error: stepsError } = await supabaseAdmin
        .from('project_steps')
        .select('status, actual_cost')
        .eq('project_id', project.id);

      if (stepsError) throw stepsError;
      steps = data ?? [];
    }

    const { data: mods, error: modsError } = await supabaseAdmin
      .from('modifications')
      .select('cost')
      .eq('car_id', carId);

    if (modsError) throw modsError;

    const aggregates = computeCarAggregates(steps, mods ?? []);

    if (project) {
      const { error: updateProjectError } = await supabaseAdmin
        .from('projects')
        .update({
          budget_spent: aggregates.budgetSpent,
          modifications_total: aggregates.modificationsTotal,
          modifications_done: aggregates.modificationsDone,
        })
        .eq('id', project.id);

      if (updateProjectError) throw updateProjectError;
    }

    const { error: carError } = await supabaseAdmin
      .from('cars')
      .update({
        amount_invested: aggregates.amountInvested,
        project_progress: aggregates.projectProgress,
      })
      .eq('id', carId);

    if (carError) throw carError;
  },
};
