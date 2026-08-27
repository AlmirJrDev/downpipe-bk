import { describe, expect, it } from 'vitest';
import { computeCarAggregates } from '@/modules/cars/car-aggregates.service';

describe('computeCarAggregates', () => {
  it('retorna zeros quando não há etapas nem modificações', () => {
    const result = computeCarAggregates([], []);
    expect(result).toEqual({
      budgetSpent: 0,
      modificationsTotal: 0,
      modificationsDone: 0,
      amountInvested: 0,
      projectProgress: 0,
    });
  });

  it('calcula budgetSpent somando apenas actual_cost das etapas', () => {
    const result = computeCarAggregates(
      [
        { status: 'done', actual_cost: 1000 },
        { status: 'pending', actual_cost: null },
        { status: 'active', actual_cost: 500 },
      ],
      []
    );
    expect(result.budgetSpent).toBe(1500);
  });

  it('calcula modificationsTotal e modificationsDone corretamente', () => {
    const result = computeCarAggregates(
      [
        { status: 'done', actual_cost: 100 },
        { status: 'done', actual_cost: 200 },
        { status: 'pending', actual_cost: null },
      ],
      []
    );
    expect(result.modificationsTotal).toBe(3);
    expect(result.modificationsDone).toBe(2);
  });

  it('calcula projectProgress como percentual arredondado', () => {
    const result = computeCarAggregates(
      [
        { status: 'done', actual_cost: 0 },
        { status: 'done', actual_cost: 0 },
        { status: 'pending', actual_cost: 0 },
      ],
      []
    );
    // 2/3 = 66.67% -> arredonda para 67
    expect(result.projectProgress).toBe(67);
  });

  it('soma o custo das modificações ao budgetSpent para formar amountInvested', () => {
    const result = computeCarAggregates(
      [{ status: 'done', actual_cost: 1000 }],
      [{ cost: 300 }, { cost: 200 }, { cost: null }]
    );
    expect(result.amountInvested).toBe(1500); // 1000 + 300 + 200
  });

  it('mantém projectProgress em 0 quando não há etapas, mesmo com modificações', () => {
    const result = computeCarAggregates([], [{ cost: 500 }]);
    expect(result.projectProgress).toBe(0);
    expect(result.amountInvested).toBe(500);
  });
});
