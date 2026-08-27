import { describe, expect, it } from 'vitest';
import {
  uuidParamSchema,
  brandIdParamSchema,
  searchQuerySchema,
} from '@/modules/vehicle-catalog/vehicle-catalog.schema';

describe('vehicle-catalog schemas', () => {
  it('aceita um uuid válido', () => {
    const result = uuidParamSchema.safeParse({ id: '123e4567-e89b-12d3-a456-426614174000' });
    expect(result.success).toBe(true);
  });

  it('rejeita um id que não é uuid', () => {
    const result = brandIdParamSchema.safeParse({ brandId: 'nao-e-uuid' });
    expect(result.success).toBe(false);
  });

  it('exige o parâmetro de busca "q"', () => {
    const result = searchQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('aceita uma busca válida', () => {
    const result = searchQuerySchema.safeParse({ q: 'golf' });
    expect(result.success).toBe(true);
  });
});
