import { describe, expect, it } from 'vitest';
import { listActiveAdsQuerySchema } from '@/modules/advertisements/advertisements.schema';

describe('listActiveAdsQuerySchema', () => {
  it('usa limit=5 como padrão quando não informado', () => {
    const result = listActiveAdsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(5);
    }
  });

  it('coage string numérica de query param', () => {
    const result = listActiveAdsQuerySchema.safeParse({ limit: '3' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(3);
    }
  });

  it('rejeita limit acima do máximo permitido', () => {
    expect(listActiveAdsQuerySchema.safeParse({ limit: '50' }).success).toBe(false);
  });

  it('rejeita limit menor que 1', () => {
    expect(listActiveAdsQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });
});
