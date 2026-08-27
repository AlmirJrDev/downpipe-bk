import { describe, expect, it } from 'vitest';
import {
  createModificationSchema,
  updateModificationSchema,
} from '@/modules/modifications/modifications.schema';

describe('createModificationSchema', () => {
  it('exige name', () => {
    expect(createModificationSchema.safeParse({}).success).toBe(false);
  });

  it('aceita um payload válido', () => {
    const result = createModificationSchema.safeParse({
      name: 'Suspensão coilover',
      category: 'Suspensão',
      cost: 3500,
      date: '2026-01-10',
      icon: 'wrench',
      description: 'Kit BC Racing',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita categoria fora do enum', () => {
    expect(
      createModificationSchema.safeParse({ name: 'X', category: 'Categoria Inválida' }).success
    ).toBe(false);
  });

  it('rejeita custo negativo', () => {
    expect(createModificationSchema.safeParse({ name: 'X', cost: -1 }).success).toBe(false);
  });
});

describe('updateModificationSchema', () => {
  it('rejeita objeto vazio', () => {
    expect(updateModificationSchema.safeParse({}).success).toBe(false);
  });

  it('aceita atualização parcial válida', () => {
    expect(updateModificationSchema.safeParse({ cost: 4000 }).success).toBe(true);
  });
});
