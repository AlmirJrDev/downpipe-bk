import { describe, expect, it } from 'vitest';
import { searchQuerySchema } from '@/modules/search/search.schema';

describe('searchQuerySchema', () => {
  it('exige o parâmetro "q"', () => {
    expect(searchQuerySchema.safeParse({}).success).toBe(false);
  });

  it('aceita uma busca válida', () => {
    expect(searchQuerySchema.safeParse({ q: 'civic' }).success).toBe(true);
  });

  it('rejeita "q" vazio', () => {
    expect(searchQuerySchema.safeParse({ q: '' }).success).toBe(false);
  });
});
