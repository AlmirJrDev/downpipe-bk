import { describe, expect, it } from 'vitest';
import { createProjectSchema, updateProjectSchema } from '@/modules/projects/projects.schema';

describe('createProjectSchema', () => {
  it('exige title', () => {
    expect(createProjectSchema.safeParse({}).success).toBe(false);
  });

  it('aceita um payload válido', () => {
    const result = createProjectSchema.safeParse({
      title: 'Stage 2 Turbo',
      powerGoalFrom: 200,
      powerGoalTo: 300,
      budgetTotal: 15000,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita powerGoalFrom maior que powerGoalTo', () => {
    const result = createProjectSchema.safeParse({
      title: 'Projeto inválido',
      powerGoalFrom: 400,
      powerGoalTo: 300,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita tentativa de enviar budget_spent diretamente (campo derivado)', () => {
    const result = createProjectSchema.safeParse({ title: 'X', budget_spent: 999 });
    expect(result.success).toBe(false);
  });
});

describe('updateProjectSchema', () => {
  it('rejeita objeto vazio', () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
  });

  it('aceita atualização parcial válida', () => {
    expect(updateProjectSchema.safeParse({ budgetTotal: 20000 }).success).toBe(true);
  });
});
