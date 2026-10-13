import { describe, expect, it } from 'vitest';
import { normalizarLink, novoLinkSchema } from '@/modules/event-suggestions/links';

describe('caixa de links de encontro', () => {
  it('o mesmo post do Instagram, copiado de jeitos diferentes, vira um link só', () => {
    const a = normalizarLink('https://www.instagram.com/p/DdPiJS7NiCa/?igsh=MWx0eWZ4ZHRrdm9xdw==');
    const b = normalizarLink('https://instagram.com/p/DdPiJS7NiCa');
    const c = normalizarLink('https://m.instagram.com/p/DdPiJS7NiCa/#comentarios');
    expect(a).toBe('https://instagram.com/p/DdPiJS7NiCa');
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('fora do Instagram, tira só o rastreio e mantém o resto da busca', () => {
    expect(normalizarLink('https://www.sympla.com.br/evento/x/123?utm_source=ig&lang=pt')).toBe(
      'https://sympla.com.br/evento/x/123?lang=pt'
    );
  });

  it('aceita só link inteiro', () => {
    expect(novoLinkSchema.safeParse({ url: 'instagram.com/p/abc' }).success).toBe(false);
    expect(novoLinkSchema.safeParse({ url: 'https://instagram.com/p/abc', note: 'Sumaré, sábado' }).success).toBe(true);
  });
});
