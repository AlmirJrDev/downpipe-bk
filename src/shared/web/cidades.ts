/**
 * Páginas de agenda: /encontros e /encontros/<cidade>.
 *
 * É o que responde à busca "encontro de carro em Campinas". A página do
 * rolê responde a quem já sabe o nome do rolê; esta responde a quem ainda
 * não sabe que rolê existe — que é quase todo mundo.
 *
 * HTML montado no servidor, sem o app por baixo: abre na hora no 4G, e o
 * Google lê tudo sem precisar rodar JavaScript. O visual é o da landing.
 */

export interface RoleDaAgenda {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string | null;
  ends_at_estimated: boolean;
  location: string;
  city: string;
  entry_note: string | null;
  photo_url: string | null;
  photo_thumb_url: string | null;
  organizer_instagram: string | null;
}

/** "São Bernardo do Campo" → "sao-bernardo-do-campo". */
export function slugDaCidade(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Tudo que é escrito por usuário passa por aqui antes de virar HTML. */
function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonNoScript(dados: unknown): string {
  return JSON.stringify(dados).replace(/</g, '\\u003c');
}

const FUSO = 'America/Sao_Paulo';
const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** Dia, mês e hora no horário de Brasília — o servidor roda em UTC. */
function emSP(iso: string) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: FUSO,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  );
  const semana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partes.weekday);
  return {
    semana: DIAS[semana],
    dia: partes.day.padStart(2, '0'),
    mes: MESES[Number(partes.month) - 1],
    hora: `${partes.hour}:${partes.minute}`,
  };
}

function quando(r: RoleDaAgenda): string {
  const ini = emSP(r.starts_at);
  const fim = r.ends_at ? emSP(r.ends_at) : null;
  const ate = fim ? (r.ends_at_estimated ? ` até ~${fim.hora}` : ` às ${fim.hora}`) : '';
  return `${ini.semana} ${ini.dia} ${ini.mes} · ${ini.hora}${fim ? ` ${ate.trim()}` : ''}`;
}

/**
 * "Entrada: Entrada gratuita" repetia a palavra. Quando o próprio texto já
 * começa dizendo que é a entrada, ele vai sozinho.
 */
function linhaDaEntrada(nota: string): string {
  return /^entrada\b/i.test(nota.trim()) ? nota.trim() : `Entrada: ${nota.trim()}`;
}

/** Os primeiros cartões aparecem sem rolar: carregar tarde só atrasa o que se vê primeiro. */
const CARTOES_NO_TOPO = 3;

function cartao(r: RoleDaAgenda, mostrarCidade: boolean, posicao: number): string {
  const ini = emSP(r.starts_at);
  const imagem = r.photo_thumb_url ?? r.photo_url;
  const carregar = posicao < CARTOES_NO_TOPO ? 'eager' : 'lazy';
  const capa = imagem
    ? `<img src="${esc(imagem)}" alt="" width="88" height="88" loading="${carregar}" decoding="async">`
    : `<span class="data"><b>${ini.dia}</b>${ini.mes}</span>`;
  const onde = mostrarCidade ? `${esc(r.location)} · ${esc(r.city)}` : esc(r.location);
  return `<li><a class="role" href="/app/event/${esc(r.id)}">
  <span class="capa">${capa}</span>
  <span class="corpo">
    <span class="quando">${esc(quando(r))}</span>
    <strong>${esc(r.name)}</strong>
    <span class="onde">${onde}</span>
    ${r.entry_note ? `<span class="entrada">${esc(linhaDaEntrada(r.entry_note))}</span>` : ''}
    ${r.organizer_instagram ? `<span class="org">@${esc(r.organizer_instagram)}</span>` : ''}
  </span>
</a></li>`;
}

const ESTILO = `
:root{--preto:#0E0E0E;--carbono:#161616;--borda:#2A2A2A;--texto:#fff;--apagado:#A8A8A8;--fraco:#6E6E6E;--marca:#E53935}
*{box-sizing:border-box}
html{background:var(--preto)}
body{margin:0;background:var(--preto);color:var(--texto);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.45}
a{color:inherit}
.centro{width:100%;max-width:760px;margin:0 auto;padding:0 16px}
header{position:sticky;top:0;z-index:5;height:60px;display:flex;align-items:center;background:rgba(14,14,14,.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--borda)}
header .centro{display:flex;align-items:center;justify-content:space-between}
header img{height:20px;display:block}
.botao{display:inline-block;text-decoration:none;padding:10px 16px;font-size:11px;font-weight:700;letter-spacing:1.3px;background:var(--marca);color:#fff}
.botao.linha{background:transparent;border:1px solid var(--borda)}
.botao:focus-visible,.role:focus-visible,.cidades a:focus-visible{outline:2px solid var(--marca);outline-offset:3px}
nav.trilha{margin:28px 0 10px;font-size:12px;color:var(--fraco);letter-spacing:.3px}
nav.trilha a{color:var(--apagado);text-decoration:none}
h1{font-size:clamp(26px,6vw,38px);line-height:1.1;margin:0 0 10px;text-wrap:balance}
.lead{color:var(--apagado);margin:0 0 26px;max-width:60ch}
ol.lista{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.role{display:flex;gap:14px;padding:12px;background:var(--carbono);border:1px solid var(--borda);text-decoration:none;transition:border-color .15s}
.role:hover{border-color:#454545}
.capa{flex:0 0 88px;height:88px;background:#1f1f1f;display:flex;align-items:center;justify-content:center;overflow:hidden}
.capa img{width:88px;height:88px;object-fit:cover;display:block}
.data{display:flex;flex-direction:column;align-items:center;font-size:11px;font-weight:700;color:var(--apagado);letter-spacing:1px}
.data b{font-size:26px;color:#fff;line-height:1}
.corpo{display:flex;flex-direction:column;gap:3px;min-width:0}
.quando{font-size:11px;font-weight:700;letter-spacing:1.2px;color:var(--marca)}
.corpo strong{font-size:16px;line-height:1.25}
.onde,.entrada{font-size:13px;color:var(--apagado)}
.org{font-size:12px;color:var(--fraco)}
.vazio{padding:28px 18px;border:1px dashed var(--borda);color:var(--apagado)}
h2{font-size:13px;letter-spacing:1.4px;color:var(--apagado);margin:40px 0 12px;font-weight:700}
.cidades{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
.cidades a{display:inline-block;padding:8px 12px;border:1px solid var(--borda);text-decoration:none;font-size:13px}
.cidades a:hover{border-color:#454545}
.cidades span{color:var(--fraco);margin-left:4px}
.avise{margin:44px 0 20px;padding:20px;background:var(--carbono);border:1px solid var(--borda);display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between}
.avise p{margin:0;color:var(--apagado);font-size:14px;max-width:44ch}
.avise strong{color:#fff;display:block;font-size:16px;margin-bottom:2px}
.acoes{display:flex;flex-wrap:wrap;gap:8px}
footer{padding:26px 0 40px;color:var(--fraco);font-size:12px}
footer a{color:var(--apagado)}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

interface Moldura {
  titulo: string;
  descricao: string;
  canonica: string;
  indexar: boolean;
  marcacao: unknown[];
  miolo: string;
}

function moldura(m: Moldura): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(m.titulo)}</title>
<meta name="description" content="${esc(m.descricao)}">
<link rel="canonical" href="${esc(m.canonica)}">
${m.indexar ? '' : '<meta name="robots" content="noindex, follow">'}
<meta property="og:site_name" content="Downpipe">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(m.titulo)}">
<meta property="og:description" content="${esc(m.descricao)}">
<meta property="og:url" content="${esc(m.canonica)}">
<meta name="theme-color" content="#0E0E0E">
<link rel="icon" href="/icon-192.png">
<style>${ESTILO}</style>
${m.marcacao.map((d) => `<script type="application/ld+json">${jsonNoScript(d)}</script>`).join('\n')}
</head>
<body>
<header><div class="centro">
  <a href="/" aria-label="Downpipe"><img src="/logo-lp.png" alt="Downpipe" width="120" height="20"></a>
  <a class="botao" href="/app/">ABRIR O APP</a>
</div></header>
<main class="centro">
${m.miolo}
<section class="avise">
  <p><strong>Organiza um rolê?</strong>Publique aqui, de graça. Você preenche tudo primeiro e cria a conta só no fim, na hora de publicar.</p>
  <div class="acoes">
    <a class="botao" href="/app/add-event">PUBLICAR MEU ROLÊ</a>
    <a class="botao linha" href="/app/sugerir-role">VI UM ROLÊ POR AÍ</a>
  </div>
</section>
</main>
<footer><div class="centro">Downpipe · a garagem do seu projeto e a agenda dos rolês · <a href="/privacidade">Privacidade</a> · <a href="/termos">Termos</a></div></footer>
</body>
</html>`;
}

function listaDeCidades(cidades: { nome: string; total: number }[], atual?: string): string {
  const outras = cidades.filter((c) => slugDaCidade(c.nome) !== atual);
  if (outras.length === 0) return '';
  return `<ul class="cidades">${outras
    .map(
      (c) =>
        `<li><a href="/encontros/${slugDaCidade(c.nome)}">${esc(c.nome)}${c.total ? `<span>${c.total}</span>` : ''}</a></li>`
    )
    .join('')}</ul>`;
}

/** Cidades com rolê agendado, das que têm mais pras que têm menos. */
export function cidadesComRole(roles: RoleDaAgenda[]): { nome: string; total: number }[] {
  const contagem = new Map<string, { nome: string; total: number }>();
  for (const r of roles) {
    const chave = slugDaCidade(r.city);
    const atual = contagem.get(chave) ?? { nome: r.city, total: 0 };
    atual.total += 1;
    contagem.set(chave, atual);
  }
  return [...contagem.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function listaDeItens(origem: string, roles: RoleDaAgenda[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: roles.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${origem}/app/event/${r.id}`,
    })),
  };
}

/** /encontros — a agenda inteira. */
export function paginaDaAgenda(origem: string, roles: RoleDaAgenda[]): string {
  const cidades = cidadesComRole(roles);
  const n = roles.length;
  const descricao =
    n > 0
      ? `${n} próximos encontros de carro em ${cidades.length} ${cidades.length === 1 ? 'cidade' : 'cidades'}: data, endereço, o que pede na entrada e o que é proibido. Atualizado todo dia.`
      : 'A agenda dos encontros de carro: data, endereço, o que pede na entrada e o que é proibido.';

  const miolo = `<nav class="trilha" aria-label="Você está em"><a href="/">Downpipe</a> › Encontros</nav>
<h1>Encontros de carro: a agenda dos próximos rolês</h1>
<p class="lead">Rolê de baixo, JDM, clássico, drift e track day. Com o que cada um pede na entrada e o que é proibido — antes de você sair de casa.</p>
${cidades.length ? `<h2>POR CIDADE</h2>${listaDeCidades(cidades)}` : ''}
<h2>PRÓXIMOS</h2>
${n ? `<ol class="lista">${roles.map((r, i) => cartao(r, true, i)).join('')}</ol>` : '<p class="vazio">Nenhum rolê agendado agora. Viu algum por aí? Avisa a gente aqui embaixo.</p>'}`;

  return moldura({
    titulo: 'Encontros de carro: agenda dos próximos rolês · Downpipe',
    descricao,
    canonica: `${origem}/encontros`,
    indexar: true,
    marcacao: [listaDeItens(origem, roles)],
    miolo,
  });
}

/**
 * /encontros/<cidade>.
 *
 * null quando a cidade nunca teve rolê público — aí é 404 de verdade. Cidade
 * que já teve e está sem agenda agora devolve a página com noindex: continua
 * existindo pra quem tem o link, e o Google volta a indexar quando aparecer
 * rolê de novo, em vez de mostrar uma página vazia na busca.
 */
export function paginaDaCidade(
  origem: string,
  slug: string,
  roles: RoleDaAgenda[],
  cidadesConhecidas: string[]
): { html: string; indexar: boolean } | null {
  const nome = cidadesConhecidas.find((c) => slugDaCidade(c) === slug);
  if (!nome) return null;

  const daqui = roles.filter((r) => slugDaCidade(r.city) === slug);
  const outras = cidadesComRole(roles);
  const n = daqui.length;
  const indexar = n > 0;

  const descricao =
    n === 0
      ? `Nenhum encontro de carro agendado em ${nome} agora. Veja os próximos rolês nas cidades perto.`
      : n === 1
        ? `O próximo encontro de carro em ${nome}: data, endereço, o que pede na entrada e o que é proibido.`
        : `${n} próximos encontros de carro em ${nome}: data, endereço, o que pede na entrada e o que é proibido. Atualizado todo dia.`;

  const miolo = `<nav class="trilha" aria-label="Você está em"><a href="/">Downpipe</a> › <a href="/encontros">Encontros</a> › ${esc(nome)}</nav>
<h1>Encontros de carro em ${esc(nome)}</h1>
<p class="lead">${
    n === 0
      ? `Nenhum rolê agendado em ${esc(nome)} agora. Os próximos nas outras cidades estão logo abaixo.`
      : `${n === 1 ? 'O próximo rolê' : `Os ${n} próximos rolês`} em ${esc(nome)}, com o que cada um pede na entrada e o que é proibido.`
  }</p>
${n ? `<ol class="lista">${daqui.map((r, i) => cartao(r, false, i)).join('')}</ol>` : ''}
${outras.length ? `<h2>OUTRAS CIDADES</h2>${listaDeCidades(outras, slug)}` : ''}`;

  const trilha = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Encontros', item: `${origem}/encontros` },
      { '@type': 'ListItem', position: 2, name: nome, item: `${origem}/encontros/${slug}` },
    ],
  };

  return {
    indexar,
    html: moldura({
      titulo: `Encontros de carro em ${nome} · Downpipe`,
      descricao,
      canonica: `${origem}/encontros/${slug}`,
      indexar,
      marcacao: n ? [trilha, listaDeItens(origem, daqui)] : [trilha],
      miolo,
    }),
  };
}
