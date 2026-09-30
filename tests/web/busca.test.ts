import { describe, expect, it } from 'vitest';
import {
  destinoDaMudanca,
  robotsTxt,
  marcacaoDeEvento,
  sitemapXml,
  tagsDeBusca,
  RoleParaBusca,
} from '@/shared/web/busca';

const URL = 'https://downpipe.onrender.com/app/event/e1';

const role = (extra: Partial<RoleParaBusca> = {}): RoleParaBusca => ({
  name: 'Drift Fest 3',
  description: null,
  startsAt: '2026-10-03T19:00:00+00:00',
  endsAt: '2026-10-04T01:00:00+00:00',
  location: 'Shopping Central Park',
  city: 'Cotia',
  address: null,
  latitude: -23.6,
  longitude: -46.9,
  photoUrl: 'https://storage/flyer.jpg',
  entryNote: 'Expositor R$ 20',
  organizerInstagram: 'low_meeting',
  organizer: { username: 'almir', displayName: 'Almir' },
  visibility: 'public',
  ...extra,
});

describe('marcação de evento pro Google', () => {
  it('tem o que o Google exige: nome, início e local com nome e endereço', () => {
    const m = marcacaoDeEvento(role(), URL) as Record<string, any>;
    expect(m['@type']).toBe('Event');
    expect(m.name).toBe('Drift Fest 3');
    expect(m.startDate).toBe('2026-10-03T19:00:00+00:00');
    expect(m.location.name).toBe('Shopping Central Park');
    expect(m.location.address.addressLocality).toBe('Cotia');
    expect(m.location.address.addressCountry).toBe('BR');
  });

  it('o organizador é o @ de quem organiza, não quem publicou aqui', () => {
    const m = marcacaoDeEvento(role(), URL) as Record<string, any>;
    expect(m.organizer).toEqual({
      '@type': 'Organization',
      name: '@low_meeting',
      url: 'https://www.instagram.com/low_meeting/',
    });
  });

  it('sem descrição escrita, monta uma com o lugar e a entrada', () => {
    const m = marcacaoDeEvento(role(), URL) as Record<string, any>;
    expect(m.description).toBe('Encontro de carros em Shopping Central Park, Cotia. Entrada: Expositor R$ 20.');
  });

  it('sem coordenada, não inventa geo', () => {
    const m = marcacaoDeEvento(role({ latitude: null, longitude: null }), URL) as Record<string, any>;
    expect(m.location.geo).toBeUndefined();
  });
});

describe('tags da página do rolê', () => {
  /**
   * Nome de rolê é escrito por usuário. Um "</script>" no nome fecharia a
   * marcação e o resto viraria código na página de quem abrisse.
   */
  it('nome com </script> não fecha a tag', () => {
    const tags = tagsDeBusca(role({ name: 'Rolê</script><script>alert(1)</script>' }), URL);
    expect(tags.match(/<\/script>/g)).toHaveLength(1);
    expect(tags).toContain('\\u003c/script>');
  });

  it('rolê só por link ganha noindex e não ganha marcação', () => {
    const tags = tagsDeBusca(role({ visibility: 'link' }), URL);
    expect(tags).toContain('noindex');
    expect(tags).not.toContain('application/ld+json');
  });

  it('toda página leva o endereço canônico', () => {
    expect(tagsDeBusca(role(), URL)).toContain(`<link rel="canonical" href="${URL}"/>`);
  });
});

describe('sitemap', () => {
  it('lista os caminhos com a origem, e a data sem hora', () => {
    const xml = sitemapXml('https://downpipe.com.br', [
      { caminho: '/' },
      { caminho: '/app/event/e1', atualizadoEm: '2026-09-28T13:45:00+00:00' },
    ]);
    expect(xml).toContain('<loc>https://downpipe.com.br/</loc>');
    expect(xml).toContain('<loc>https://downpipe.com.br/app/event/e1</loc><lastmod>2026-09-28</lastmod>');
  });
});

describe('troca de domínio', () => {
  const pagina = {
    host: 'downpipe.onrender.com',
    metodo: 'GET',
    aceita: 'text/html,application/xhtml+xml',
    caminho: '/app/event/e1?x=1',
  };

  it('fica parado enquanto o APP_URL é o próprio onrender, ou não existe', () => {
    expect(destinoDaMudanca(pagina, undefined)).toBeNull();
    expect(destinoDaMudanca(pagina, 'https://downpipe.onrender.com')).toBeNull();
  });

  it('com o domínio novo, página aberta pelo endereço antigo vai pro novo', () => {
    expect(destinoDaMudanca(pagina, 'https://downpipe.com.br')).toBe(
      'https://downpipe.com.br/app/event/e1?x=1'
    );
  });

  /**
   * O app instalado pelo endereço antigo chama a API nele. Redirecionar isso
   * quebraria todo mundo no dia da troca: POST redirecionado vira GET, e
   * chamada entre domínios esbarra no CORS.
   */
  it('chamada de API não é redirecionada', () => {
    expect(destinoDaMudanca({ ...pagina, aceita: 'application/json' }, 'https://downpipe.com.br')).toBeNull();
    expect(destinoDaMudanca({ ...pagina, metodo: 'POST' }, 'https://downpipe.com.br')).toBeNull();
  });

  it('o arquivo de verificação do Google continua respondendo no endereço antigo', () => {
    expect(
      destinoDaMudanca({ ...pagina, caminho: '/google38365711ffec7a13.html' }, 'https://downpipe.com.br')
    ).toBeNull();
  });

  it('máquina de desenvolvimento nunca é mandada pra produção', () => {
    expect(
      destinoDaMudanca({ ...pagina, host: 'localhost:3000' }, 'https://downpipe.com.br')
    ).toBeNull();
  });
});

/**
 * A regra do Google pro robots.txt: vale a regra de caminho mais longo que
 * casar; empate fica com Allow. Reproduzida aqui pra testar o que o robô
 * vai fazer de verdade, não se o texto contém uma linha.
 */
function googlePode(robots: string, caminho: string): boolean {
  const regras = robots
    .split('\n')
    .map((l) => l.match(/^(Allow|Disallow):\s*(\S+)/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map(([, tipo, padrao]) => {
      // Sem "*" no nosso arquivo; "$" no fim quer dizer "exatamente isto".
      const exato = padrao.endsWith('$');
      const base = exato ? padrao.slice(0, -1) : padrao;
      return { tipo, padrao, casa: (c: string) => (exato ? c === base : c.startsWith(base)) };
    });
  const casam = regras.filter((r) => r.casa(caminho));
  if (casam.length === 0) return true;
  casam.sort((a, b) => b.padrao.length - a.padrao.length || (a.tipo === 'Allow' ? -1 : 1));
  return casam[0].tipo === 'Allow';
}

describe('robots.txt', () => {
  const robots = robotsTxt('https://downpipe.onrender.com');

  it('o Google pode ler a página do rolê, e o que ela carrega pra montar', () => {
    expect(googlePode(robots, '/app/event/ac81e59e-8631-4c16-bf63-faab4d8cac35')).toBe(true);
    expect(googlePode(robots, '/app/_expo/static/js/web/entry-abc.js')).toBe(true);
    expect(googlePode(robots, '/events/ac81e59e-8631-4c16-bf63-faab4d8cac35')).toBe(true);
    expect(googlePode(robots, '/')).toBe(true);
  });

  it('perfil, post, garagem e a área de moderação continuam fora', () => {
    expect(googlePode(robots, '/app/user/almir')).toBe(false);
    expect(googlePode(robots, '/app/post/abc')).toBe(false);
    expect(googlePode(robots, '/app/car/abc')).toBe(false);
    expect(googlePode(robots, '/app/fila-de-roles')).toBe(false);
    expect(googlePode(robots, '/profiles/abc')).toBe(false);
    expect(googlePode(robots, '/admin/suggestions')).toBe(false);
  });

  it('o sitemap aponta pro endereço configurado', () => {
    expect(robotsTxt('https://downpipe.com.br')).toContain('Sitemap: https://downpipe.com.br/sitemap.xml');
  });
});
