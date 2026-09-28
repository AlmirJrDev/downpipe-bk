import { describe, expect, it } from 'vitest';
import { imagemAnunciada } from '@/modules/event-suggestions/flyer.service';

describe('achar a arte anunciada pela página', () => {
  it('lê a og:image na ordem comum', () => {
    const html = `<meta property="og:image" content="https://cdn/flyer.jpg" />`;
    expect(imagemAnunciada(html)).toBe('https://cdn/flyer.jpg');
  });

  it('lê também quando o content vem antes do property', () => {
    const html = `<meta content="https://cdn/flyer.jpg" property="og:image">`;
    expect(imagemAnunciada(html)).toBe('https://cdn/flyer.jpg');
  });

  /**
   * As URLs do CDN do Instagram vêm com assinatura cheia de "&", que o HTML
   * escapa. Sem desfazer isso, o CDN recusa e a foto chega quebrada.
   */
  it('desfaz o escape do HTML — senão a assinatura do CDN não confere', () => {
    const html = `<meta property="og:image" content="https://cdn/f.jpg?a=1&amp;oh=00_X&amp;oe=6A" />`;
    expect(imagemAnunciada(html)).toBe('https://cdn/f.jpg?a=1&oh=00_X&oe=6A');
  });

  it('aceita twitter:image quando a página não tem og:image', () => {
    const html = `<meta name="twitter:image" content="https://cdn/t.jpg" />`;
    expect(imagemAnunciada(html)).toBe('https://cdn/t.jpg');
  });

  it('página sem prévia devolve null — é o caso do muro de login', () => {
    expect(imagemAnunciada('<html><body>Entre para continuar</body></html>')).toBeNull();
  });
});
