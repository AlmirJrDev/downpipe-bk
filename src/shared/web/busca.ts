/**
 * O que o Google precisa pra mostrar os rolês na busca.
 *
 * A prévia de link (linkPreview.ts) já entregava título, descrição e imagem
 * — que é metade do que um buscador usa. O que falta mora aqui: a marcação
 * de evento (schema.org/Event), que é o que coloca o rolê no carrossel de
 * eventos da busca, o sitemap com os rolês públicos, e o redirecionamento
 * pra quando o site trocar de domínio.
 */

/** O rolê como a marcação precisa dele — o formato público do eventsService. */
export interface RoleParaBusca {
  name: string;
  description: string | null;
  startsAt: string;
  endsAt?: string | null;
  location: string;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  photoUrl: string | null;
  entryNote?: string | null;
  organizerInstagram?: string | null;
  organizer: { username: string; displayName: string } | null;
  visibility: 'public' | 'link';
}

/**
 * Serializa pra dentro de um <script>.
 *
 * Nome de rolê e descrição são escritos por usuários: um "</script>" no meio
 * fecharia a tag e o resto viraria HTML da página. Trocar "<" pelo escape
 * unicode mantém o JSON idêntico pra quem lê e impossível de fechar a tag.
 */
function jsonNoScript(dados: unknown): string {
  return JSON.stringify(dados).replace(/</g, '\\u003c');
}

function descricaoDoRole(r: RoleParaBusca): string {
  if (r.description?.trim()) return r.description.trim().slice(0, 500);
  const partes = [`Encontro de carros em ${r.location}, ${r.city}.`];
  if (r.entryNote) partes.push(`Entrada: ${r.entryNote}.`);
  return partes.join(' ');
}

/**
 * A marcação schema.org/Event do rolê.
 *
 * Os obrigatórios do Google são nome, início e local com nome e endereço; o
 * resto é recomendado e melhora o resultado. O organizador é o @ de quem
 * organiza quando o rolê veio de fora — é dele o encontro, e é o que a
 * própria tela do app mostra.
 */
export function marcacaoDeEvento(r: RoleParaBusca, url: string): Record<string, unknown> {
  const local: Record<string, unknown> = {
    '@type': 'Place',
    name: r.location,
    address: {
      '@type': 'PostalAddress',
      streetAddress: r.address ?? r.location,
      addressLocality: r.city,
      addressCountry: 'BR',
    },
  };
  if (r.latitude != null && r.longitude != null) {
    local.geo = { '@type': 'GeoCoordinates', latitude: r.latitude, longitude: r.longitude };
  }

  const organizador = r.organizerInstagram
    ? {
        '@type': 'Organization',
        name: `@${r.organizerInstagram}`,
        url: `https://www.instagram.com/${r.organizerInstagram}/`,
      }
    : r.organizer
      ? { '@type': 'Person', name: r.organizer.displayName }
      : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: r.name,
    description: descricaoDoRole(r),
    startDate: r.startsAt,
    ...(r.endsAt ? { endDate: r.endsAt } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: local,
    ...(r.photoUrl ? { image: [r.photoUrl] } : {}),
    ...(organizador ? { organizer: organizador } : {}),
    url,
  };
}

/**
 * As tags a mais que a página de um rolê leva no <head>.
 *
 * Rolê "só por link" ganha noindex: quem escolheu não aparecer no
 * calendário também não quer aparecer no Google — e é justamente esse o
 * rolê que não pode vazar.
 */
export function tagsDeBusca(r: RoleParaBusca, url: string): string {
  const canonica = `<link rel="canonical" href="${url.replace(/"/g, '&quot;')}"/>`;
  if (r.visibility !== 'public') {
    return `${canonica}<meta name="robots" content="noindex, nofollow"/>`;
  }
  return `${canonica}<script type="application/ld+json">${jsonNoScript(marcacaoDeEvento(r, url))}</script>`;
}

/**
 * O robots.txt, servido pelo servidor e não como arquivo fixo: o endereço
 * do sitemap vem do APP_URL, então a troca de domínio não depende de alguém
 * lembrar de editar este texto.
 *
 * Pro Google, a regra de caminho mais longo vence: "Allow: /app/event/"
 * ganha de "Disallow: /app/" para as páginas de rolê.
 */
export function robotsTxt(origem: string): string {
  return [
    '# O que os buscadores devem e não devem indexar.',
    'User-agent: *',
    '',
    '# A landing, as páginas legais e os rolês públicos. Rolê "só por link"',
    '# sai com noindex na própria página.',
    'Allow: /$',
    'Allow: /privacidade',
    'Allow: /termos',
    'Allow: /app/event/',
    'Allow: /encontros',
    '',
    '# Os arquivos do app: o Google roda o JavaScript pra montar a página do',
    '# rolê, e sem eles veria só a tela de carregamento.',
    'Allow: /app/_expo/',
    'Allow: /app/assets/',
    '',
    '# O resto do app não: perfil, post e garagem são das pessoas.',
    'Disallow: /app/',
    '',
    '# API não é página. /events/ fica de fora da lista de propósito: é dela',
    '# que a página do rolê puxa os dados, e as respostas já saem com',
    '# X-Robots-Tag: noindex.',
    'Disallow: /auth/',
    'Disallow: /posts/',
    'Disallow: /profiles/',
    'Disallow: /profile/',
    'Disallow: /cars/',
    'Disallow: /feed',
    'Disallow: /reports',
    'Disallow: /search',
    'Disallow: /status',
    'Disallow: /vehicles/',
    'Disallow: /notifications',
    'Disallow: /admin/',
    '',
    `Sitemap: ${origem}/sitemap.xml`,
    '',
  ].join('\n');
}

export interface EntradaDoSitemap {
  caminho: string;
  atualizadoEm?: string;
}

function escaparXml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** O sitemap, montado na hora a partir do banco: rolê novo entra sozinho. */
export function sitemapXml(origem: string, entradas: EntradaDoSitemap[]): string {
  const urls = entradas
    .map((e) => {
      const lastmod = e.atualizadoEm ? `<lastmod>${e.atualizadoEm.slice(0, 10)}</lastmod>` : '';
      return `<url><loc>${escaparXml(`${origem}${e.caminho}`)}</loc>${lastmod}</url>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

/**
 * Pra onde mandar quem chegou pelo endereço antigo, quando o domínio mudar.
 *
 * Fica parado até APP_URL apontar pra um domínio diferente do onrender.com —
 * aí vira um 301, que é o que diz ao Google "mudou de endereço, leve o que
 * este aqui tinha". Só navegação de página é redirecionada: a API continua
 * respondendo nos dois endereços, senão o app de quem instalou pelo
 * endereço antigo parava de funcionar no mesmo dia (POST redirecionado vira
 * GET, e chamada entre domínios esbarra no CORS). E só o host do Render,
 * pra máquina de desenvolvimento nunca ser mandada pra produção.
 *
 * O arquivo de verificação do Search Console fica de fora: a ferramenta de
 * mudança de endereço do Google exige o endereço antigo ainda verificado, e
 * a verificação por arquivo não aceita redirecionamento pra outro domínio.
 */
export function destinoDaMudanca(
  pedido: { host: string; metodo: string; aceita: string; caminho: string },
  appUrl: string | undefined
): string | null {
  if (!appUrl) return null;
  let novo: URL;
  try {
    novo = new URL(appUrl);
  } catch {
    return null;
  }
  if (!pedido.host.endsWith('.onrender.com')) return null;
  if (/^\/google[0-9a-f]+\.html$/.test(pedido.caminho)) return null;
  if (pedido.host === novo.host) return null;
  if (pedido.metodo !== 'GET' && pedido.metodo !== 'HEAD') return null;
  if (!pedido.aceita.includes('text/html')) return null;
  return `${novo.origin}${pedido.caminho}`;
}
