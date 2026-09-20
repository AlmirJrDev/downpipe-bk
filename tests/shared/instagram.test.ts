import { describe, expect, it } from 'vitest';
import { instagramSchema } from '@/shared/validation/instagram';

const limpo = (valor: unknown) => instagramSchema.parse(valor);

describe('@ do Instagram', () => {
  it('aceita do jeito que as pessoas colam', () => {
    expect(limpo('meucarro')).toBe('meucarro');
    expect(limpo('@MeuCarro')).toBe('meucarro');
    expect(limpo('  @meu.carro_01  ')).toBe('meu.carro_01');
    expect(limpo('instagram.com/meucarro')).toBe('meucarro');
    expect(limpo('https://www.instagram.com/meucarro/?igsh=abc123')).toBe('meucarro');
  });

  it('campo esvaziado é pedido pra tirar o @', () => {
    expect(limpo('')).toBeNull();
    expect(limpo('   ')).toBeNull();
    expect(limpo(null)).toBeNull();
  });

  it('recusa o que não é um @', () => {
    expect(() => limpo('meu carro')).toThrow();
    expect(() => limpo('meu-carro')).toThrow();
    expect(() => limpo('a'.repeat(31))).toThrow();
  });
});
