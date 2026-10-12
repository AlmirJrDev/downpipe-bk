import { describe, expect, it } from 'vitest';
import { aparelho, createFeedbackSchema } from '@/modules/feedback/feedback';

describe('relato de experiência', () => {
  it('aceita só o texto, e nota de 1 a 5', () => {
    expect(createFeedbackSchema.parse({ message: '  curti o mapa  ' }).message).toBe('curti o mapa');
    expect(createFeedbackSchema.safeParse({ message: 'ok', rating: 5 }).success).toBe(true);
    expect(createFeedbackSchema.safeParse({ message: 'ok', rating: 0 }).success).toBe(false);
    expect(createFeedbackSchema.safeParse({ message: 'ok', rating: 6 }).success).toBe(false);
  });

  it('recusa relato vazio ou só com espaço', () => {
    expect(createFeedbackSchema.safeParse({ message: '' }).success).toBe(false);
    expect(createFeedbackSchema.safeParse({ message: '   ' }).success).toBe(false);
  });

  it('resume o aparelho sem guardar o user-agent inteiro', () => {
    expect(
      aparelho(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
      )
    ).toBe('Celular · iOS · Safari');
    expect(
      aparelho(
        'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
      )
    ).toBe('Celular · Android · Chrome');
    expect(
      aparelho('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36')
    ).toBe('Computador · Windows · Chrome');
    expect(aparelho(undefined)).toBeNull();
  });
});
