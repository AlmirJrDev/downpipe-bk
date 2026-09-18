import { describe, expect, it } from 'vitest';
import { comPrevia } from '@/shared/web/linkPreview';

const CASCA =
  '<html><head><title>Downpipe</title><meta name="description" content="padrão"/></head><body></body></html>';

describe('prévia de link compartilhado', () => {
  it('troca título e descrição e põe as tags Open Graph', () => {
    const html = comPrevia(
      CASCA,
      { titulo: 'Rolê de sábado', descricao: 'Posto Graal, São Paulo', imagem: 'https://x/y.jpg' },
      'https://downpipe.onrender.com/app/event/1',
      'https://downpipe.onrender.com/og-banner.png'
    );

    expect(html).toContain('<title>Rolê de sábado</title>');
    expect(html).toContain('<meta property="og:image" content="https://x/y.jpg"/>');
    expect(html).not.toContain('content="padrão"');
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  it('escapa o que o usuário escreveu, pra legenda não virar código na página', () => {
    const html = comPrevia(
      CASCA,
      { titulo: 'x"><script>alert(1)</script>', descricao: 'a & b', imagem: null },
      'https://downpipe.onrender.com/app/post/1',
      'https://downpipe.onrender.com/og-banner.png'
    );

    expect(html).not.toContain('<script>');
    expect(html).toContain('x&quot;&gt;&lt;script&gt;');
    expect(html).toContain('a &amp; b');
  });

  it('sem foto no conteúdo, usa a imagem padrão', () => {
    const html = comPrevia(
      CASCA,
      { titulo: 't', descricao: 'd', imagem: null },
      'https://downpipe.onrender.com/app/user/fulano',
      'https://downpipe.onrender.com/og-banner.png'
    );

    expect(html).toContain('og:image" content="https://downpipe.onrender.com/og-banner.png"');
  });
});
