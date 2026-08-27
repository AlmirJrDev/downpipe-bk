import { describe, expect, it } from 'vitest';
import { parseFipePrice } from '@/modules/vehicle-sync/fipe.client';

describe('parseFipePrice', () => {
  it('converte um valor no formato da FIPE em número', () => {
    expect(parseFipePrice('R$ 45.000,00')).toBe(45000);
  });

  it('lida com valores sem casas decimais explícitas', () => {
    expect(parseFipePrice('R$ 1.234,50')).toBe(1234.5);
  });

  it('retorna null para valores não numéricos', () => {
    expect(parseFipePrice('indisponível')).toBeNull();
  });
});
