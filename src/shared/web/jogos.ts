/**
 * As páginas dos jogos que o Google lê.
 *
 * O jogo em si mora no app (/app/nave-do-dia), que é montado no navegador:
 * o buscador vê pouco ali. Estas páginas saem prontas do servidor, com o
 * que alguém digita no Google ("jogo de adivinhar carro", "wordle de
 * carro"), as regras, perguntas frequentes e a marcação de aplicativo de
 * jogo grátis — e um botão grande pra jogar.
 *
 * /jogos é a vitrine; cada jogo novo ganha um cartão lá e a própria página.
 */

/** Mesmo início do app (utils/naveDoDia.ts): o #1 foi em 13/10/2026. */
const INICIO_DA_NAVE = '2026-10-13';

export function numeroDaNaveDoDia(agora = new Date()): number {
  const dia = agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const ms = Date.parse(`${dia}T12:00:00Z`) - Date.parse(`${INICIO_DA_NAVE}T12:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const json = (d: unknown) => JSON.stringify(d).replace(/</g, '\\u003c');

const ESTILO = `
@font-face{font-family:'Archivo';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(/fonts/archivo-latin.woff2) format('woff2')}
@font-face{font-family:'JetBrains Mono';font-style:normal;font-display:swap;font-weight:700;src:url(/fonts/jetbrains-mono-700.woff2) format('woff2')}
:root{--fundo:#0e0e0e;--carbono:#161616;--borda:#2a2a2a;--texto:#f0f0f0;--apagado:#a3a3a3;--fraco:#8a8a8a;--marca:#da291c;--viva:#ff4a3d;--verde:#15803d;--amarelo:#a16207;--vermelho:#7f1d1d;--mono:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace}
*{box-sizing:border-box}
html,body{margin:0;background:var(--fundo);color:var(--texto);font-family:'Archivo',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--viva)}
.centro{max-width:960px;margin:0 auto;padding:0 20px}
header{border-bottom:1px solid #222;position:sticky;top:0;background:rgba(14,14,14,.92);backdrop-filter:blur(10px);z-index:2}
header .centro{display:flex;align-items:center;justify-content:space-between;height:60px}
header img{height:22px;width:auto;display:block}
.botao{display:inline-block;background:var(--marca);color:#fff;text-decoration:none;font:700 14px var(--mono);letter-spacing:.12em;padding:16px 24px}
.botao:hover{background:var(--viva);color:#fff}
.botao.linha{background:transparent;border:1px solid #4d4d4d}
.rotulo{font:700 12px var(--mono);letter-spacing:.18em;color:var(--viva);text-transform:uppercase}
h1{font-weight:900;font-stretch:72%;text-transform:uppercase;font-size:clamp(44px,8vw,88px);line-height:.92;margin:14px 0 18px;text-wrap:balance}
h2{font-weight:900;font-stretch:76%;text-transform:uppercase;font-size:clamp(28px,4.5vw,44px);line-height:.95;margin:56px 0 16px}
p{font-size:17px;line-height:1.6;color:var(--apagado);max-width:62ch;text-wrap:pretty}
.heroi{padding:48px 0 8px}
.acoes{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center;margin-top:26px}
.mono{font:700 12px var(--mono);letter-spacing:.12em;color:var(--fraco)}
.tabela{overflow-x:auto;margin-top:8px}
.linha-ex{display:flex;gap:4px;min-width:720px;margin-bottom:4px}
.linha-ex div{flex:1 1 0;min-height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;text-align:center;padding:4px}
.linha-ex .nome{flex:1.6 1 0;background:#1c1c1c;border:1px solid var(--borda);justify-content:center;align-items:flex-start;padding:0 10px}
.cab div{min-height:auto;color:var(--fraco);font:700 11px var(--mono);letter-spacing:.06em;background:none}
.v{background:var(--verde)}.a{background:var(--amarelo)}.r{background:var(--vermelho)}
.legenda{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:18px}
.legenda div{border:1px solid var(--borda);padding:14px 16px;font-size:15px;color:var(--apagado);line-height:1.5}
.legenda b{display:block;color:#fff;margin-bottom:4px}
.chip{display:inline-block;width:14px;height:14px;vertical-align:-2px;margin-right:6px}
.marcas{display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:14px 0 0;list-style:none}
.marcas li{border:1px solid var(--borda);padding:8px 12px;font-size:14px}
details{border-bottom:1px solid var(--borda)}
summary{cursor:pointer;list-style:none;padding:18px 0;font-weight:700;font-size:18px;display:flex;justify-content:space-between;gap:16px}
summary::-webkit-details-marker{display:none}
summary::after{content:"+";font:500 20px var(--mono);color:var(--viva)}
details[open] summary::after{content:"−"}
details p{margin:0 0 18px}
.jogos{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:20px}
.jogo{border:1px solid var(--borda);padding:22px;text-decoration:none;color:var(--texto);display:flex;flex-direction:column;gap:10px;background:var(--carbono)}
.jogo:hover{border-color:#4d4d4d}
.jogo strong{font-weight:900;font-stretch:80%;font-size:28px;text-transform:uppercase}
.jogo span{color:var(--apagado);font-size:15px;line-height:1.5}
.jogo.breve{opacity:.55;pointer-events:none}
footer{border-top:1px solid #222;margin-top:64px;padding:26px 0 40px;color:var(--fraco);font-size:13px}
footer a{color:var(--apagado)}
:focus-visible{outline:2px solid var(--viva);outline-offset:3px}
`;

interface Moldura {
  titulo: string;
  descricao: string;
  canonica: string;
  imagem: string;
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
<meta property="og:site_name" content="Downpipe">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(m.titulo)}">
<meta property="og:description" content="${esc(m.descricao)}">
<meta property="og:url" content="${esc(m.canonica)}">
<meta property="og:image" content="${esc(m.imagem)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0E0E0E">
<link rel="icon" href="/icon-192.png">
<link rel="preload" href="/fonts/archivo-latin.woff2" as="font" type="font/woff2" crossorigin>
<style>${ESTILO}</style>
${m.marcacao.map((d) => `<script type="application/ld+json">${json(d)}</script>`).join('\n')}
</head>
<body>
<header><div class="centro">
  <a href="/" aria-label="Downpipe"><img src="/logo-lp.png" alt="Downpipe" width="132" height="22"></a>
  <a class="botao linha" href="/jogos" style="padding:10px 16px;font-size:12px">JOGOS</a>
</div></header>
<main class="centro">${m.miolo}</main>
<footer><div class="centro">Downpipe · a rede de quem vive carro · <a href="/">Início</a> · <a href="/encontros">Encontros de carro</a> · <a href="/jogos">Jogos</a> · <a href="/privacidade">Privacidade</a></div></footer>
</body>
</html>`;
}

const PERGUNTAS: [string, string][] = [
  ['Precisa de conta pra jogar?', 'Não. Abre no navegador, no celular ou no computador, e o progresso do dia fica salvo no aparelho.'],
  ['Quando muda o carro?', 'Todo dia à meia-noite, horário de Brasília. O carro do dia é o mesmo pra todo mundo, então dá pra comparar com a galera.'],
  ['O que o amarelo quer dizer?', 'Que chegou perto: país do mesmo continente, turbo e biturbo, ano a até 5 anos, potência a até 15% ou cilindros a 2 de diferença. Nos números, a seta mostra pra que lado ir.'],
  ['Quantas tentativas eu tenho?', 'Quantas quiser. O desafio é acertar com o menor número de palpites e mandar o resultado pros amigos.'],
  ['Que carros aparecem?', 'Carros que a galera conhece de nome: JDM, europeus, muscle cars americanos e clássicos nacionais, de várias épocas.'],
];

/** A página da Nave do Dia, a que deve aparecer pra "jogo de adivinhar carro". */
export function paginaDaNaveDoDia(origem: string, agora = new Date()): string {
  const numero = numeroDaNaveDoDia(agora);
  const url = `${origem}/jogos/nave-do-dia`;
  const jogar = `${origem}/app/nave-do-dia`;
  const titulo = 'Nave do Dia · Jogo de adivinhar o carro do dia | Downpipe';
  const descricao =
    'Jogo diário de carros em português: adivinhe a nave do dia pelas pistas de marca, país, motor, tração, ano e potência. Grátis, sem cadastro, no celular ou no PC.';

  const exemplo = `
<div class="tabela" role="img" aria-label="Exemplo de dois palpites, Chevrolet Opala SS 250-S e VW Gol GTI, com as pistas em verde, amarelo e vermelho">
  <div class="linha-ex cab"><div class="nome">CARRO</div><div>MARCA</div><div>PAÍS</div><div>CARROCERIA</div><div>MOTOR</div><div>TRAÇÃO</div><div>CILINDROS</div><div>ANO</div><div>POTÊNCIA</div></div>
  <div class="linha-ex"><div class="nome">Chevrolet Opala SS 250-S</div><div class="r">Chevrolet</div><div class="r">EUA</div><div class="r">Cupê</div><div class="v">Aspirado</div><div class="r">Traseira</div><div class="a">6<br>↓</div><div class="r">1976<br>↑</div><div class="a">171 cv<br>↑</div></div>
  <div class="linha-ex"><div class="nome">VW Gol GTI</div><div class="r">Volkswagen</div><div class="r">Alemanha</div><div class="v">Hatch</div><div class="v">Aspirado</div><div class="v">Dianteira</div><div class="v">4</div><div class="r">1988<br>↑</div><div class="r">120 cv<br>↑</div></div>
</div>`;

  const miolo = `
<section class="heroi">
  <div class="rotulo">Jogo diário · #${numero} de hoje</div>
  <h1>Nave do Dia: adivinhe o carro de hoje</h1>
  <p>Todo dia tem um carro secreto, o mesmo pra todo mundo. Você chuta um carro e cada palpite mostra o que bate com a nave do dia: marca, país, carroceria, motor, tração, cilindros, ano e potência. Vai afunilando até acertar.</p>
  <div class="acoes">
    <a class="botao" href="${esc(jogar)}">JOGAR O #${numero} →</a>
    <span class="mono">GRÁTIS · SEM CADASTRO · CELULAR OU PC</span>
  </div>
</section>

<h2>Como jogar</h2>
<p>Digite o nome de um carro ou de uma marca e escolha na lista. Cada palpite vira uma linha de pistas:</p>
${exemplo}
<div class="legenda">
  <div><b><span class="chip v"></span>Verde</b>Igual à nave do dia.</div>
  <div><b><span class="chip a"></span>Amarelo</b>Perto: mesmo continente, turbo e biturbo, ano a até 5 anos, potência a até 15%.</div>
  <div><b><span class="chip r"></span>Vermelho</b>Nada a ver. Nos números, a seta ↑↓ diz se a nave do dia é maior ou menor.</div>
</div>

<h2>Que carros aparecem</h2>
<p>Carros que todo mundo que curte carro conhece de nome, de vários estilos e épocas: do Fusca e do Opala aos JDM dos anos 90, europeus de pista e muscle cars americanos.</p>
<ul class="marcas">${['Toyota', 'Nissan', 'Honda', 'Mitsubishi', 'Subaru', 'Mazda', 'Volkswagen', 'BMW', 'Porsche', 'Audi', 'Mercedes-Benz', 'Ferrari', 'Lamborghini', 'Fiat', 'Peugeot', 'Renault', 'Mini', 'Chevrolet', 'Ford', 'Dodge']
    .map((m) => `<li>${m}</li>`)
    .join('')}</ul>

<h2>Perguntas</h2>
<div>${PERGUNTAS.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>

<div class="acoes" style="margin-top:40px">
  <a class="botao" href="${esc(jogar)}">JOGAR AGORA →</a>
  <a href="/jogos">Ver os outros jogos</a>
</div>`;

  return moldura({
    titulo,
    descricao,
    canonica: url,
    imagem: `${origem}/og-nave-do-dia.png`,
    miolo,
    marcacao: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Nave do Dia',
        url: jogar,
        description: descricao,
        applicationCategory: 'GameApplication',
        genre: 'Quiz de carros',
        operatingSystem: 'Web',
        inLanguage: 'pt-BR',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
        publisher: { '@type': 'Organization', name: 'Downpipe', url: origem },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: PERGUNTAS.map(([q, a]) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  });
}

/** A vitrine dos jogos. Jogo novo entra aqui com um cartão. */
export function paginaDosJogos(origem: string, agora = new Date()): string {
  const numero = numeroDaNaveDoDia(agora);
  const miolo = `
<section class="heroi">
  <div class="rotulo">Jogos de carro</div>
  <h1>Jogos do Downpipe</h1>
  <p>Jogos rápidos pra quem vive carro. Um desafio novo por dia, grátis, sem cadastro, pra jogar no celular ou no PC e comparar com a galera.</p>
</section>
<div class="jogos">
  <a class="jogo" href="/jogos/nave-do-dia">
    <span class="mono">DIÁRIO · #${numero} DE HOJE</span>
    <strong>Nave do Dia</strong>
    <span>Adivinhe o carro do dia pelas pistas de marca, país, motor, tração, ano e potência.</span>
  </a>
  <div class="jogo breve" aria-disabled="true">
    <span class="mono">EM BREVE</span>
    <strong>Mais jogos</strong>
    <span>Tem mais vindo por aí.</span>
  </div>
</div>`;
  return moldura({
    titulo: 'Jogos de carro online e grátis | Downpipe',
    descricao:
      'Jogos de carro em português pra jogar no navegador: desafios diários como a Nave do Dia, de adivinhar o carro pelas pistas. Grátis e sem cadastro.',
    canonica: `${origem}/jogos`,
    imagem: `${origem}/og-nave-do-dia.png`,
    miolo,
    marcacao: [
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: [{ '@type': 'ListItem', position: 1, url: `${origem}/jogos/nave-do-dia`, name: 'Nave do Dia' }],
      },
    ],
  });
}
