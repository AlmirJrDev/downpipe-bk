import { describe, expect, it } from 'vitest';
import { createStepSchema, updateStepSchema } from '@/modules/project-steps/project-steps.schema';

describe('createStepSchema', () => {
  it('exige name', () => {
    expect(createStepSchema.safeParse({}).success).toBe(false);
  });

  it('aceita um payload completo válido', () => {
    const result = createStepSchema.safeParse({
      name: 'Instalar turbina',
      status: 'active',
      estimatedCost: 5000,
      actualCost: 5200,
      date: '2026-03-15',
      description: 'Troca do kit turbo',
      position: 2,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita status fora do enum', () => {
    expect(createStepSchema.safeParse({ name: 'X', status: 'finished' }).success).toBe(false);
  });

  it('rejeita data em formato inválido', () => {
    expect(createStepSchema.safeParse({ name: 'X', date: '15/03/2026' }).success).toBe(false);
  });

  it('rejeita custo negativo', () => {
    expect(createStepSchema.safeParse({ name: 'X', actualCost: -100 }).success).toBe(false);
  });
});

describe('updateStepSchema', () => {
  it('rejeita objeto vazio', () => {
    expect(updateStepSchema.safeParse({}).success).toBe(false);
  });

  it('aceita atualização parcial (ex.: apenas status)', () => {
    expect(updateStepSchema.safeParse({ status: 'done' }).success).toBe(true);
  });
});
