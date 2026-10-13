/**
 * Visitas: quem abriu o site, de onde veio e até onde chegou.
 *
 * Duas portas de entrada:
 * - `contarPaginas` (middleware): a landing e as páginas públicas que o
 *   servidor monta (/encontros, /termos…). Anota quando a resposta sai 200
 *   em HTML.
 * - POST /visitas: o app avisa a cada troca de tela. O app é uma página
 *   só; o servidor vê o primeiro carregamento e nunca mais.
 *
 * GET /admin/trafego junta tudo por período pra tela "Tráfego".
 *
 * Privacidade: nada de IP guardado. O visitante vira um código de 16
 * caracteres tirado de IP + navegador + o dia, com um segredo do servidor.
 * Conta pessoas diferentes num dia e não segue ninguém de um dia pro outro.
 *
 * Quem abre a tela Tráfego ganha um cookie que tira aquele aparelho da
 * contagem — senão o número mais alto seria sempre o dono olhando o próprio
 * site.
 */
import { createHmac } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { env } from '@/config/env';
import { supabaseAdmin } from '@/config/supabase';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { requireAdmin } from '@/shared/middleware/admin.middleware';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { aparelho, navegadorDeApp } from '@/shared/web/aparelho';

// ------------------------------------------------------------- classificação

/**
 * Robô, pré-visualização de link e monitor. A prévia do WhatsApp e do
 * Instagram busca a página quando o link é colado — não é ninguém abrindo.
 * (?<!cu) porque existe celular CUBOT, e ele é gente.
 */
const ROBO =
  /(?<!cu)bot\b|bot\/|crawl|spider|slurp|bingpreview|facebookexternalhit|facebot|embedly|whatsapp\/|headless|lighthouse|pagespeed|gtmetrix|curl|wget|python|go-http|node-fetch|undici|axios|okhttp|java\/|uptime|monitor|render\/|preview/i;

export function ehRobo(userAgent: string | undefined): boolean {
  if (!userAgent) return true;
  // O Instagram pede o logo da página com um user-agent sem "Mozilla" pra
  // montar a prévia: não é a pessoa.
  if (!/mozilla/i.test(userAgent)) return true;
  return ROBO.test(userAgent);
}

const HOST_PROPRIO = /(^|\.)downpipe\.com\.br$|\.onrender\.com$|^localhost$/;

function hostDe(endereco: string | undefined | null): string | null {
  if (!endereco) return null;
  try {
    return new URL(endereco).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * De onde a pessoa veio, em palavras que dá pra ler na tela. O `utm_` do
 * anúncio manda primeiro; depois o site anterior; depois o navegador do
 * app (o Instagram nem sempre conta de onde veio, mas o navegador dele se
 * entrega). "Interno" é andar de uma página nossa pra outra.
 */
export function origemDa(entrada: {
  utmSource?: string | null;
  utmMedium?: string | null;
  referrer?: string | null;
  userAgent?: string;
}): string {
  const fonte = entrada.utmSource?.toLowerCase().trim();
  const pago = /paid|cpc|ads?$/.test(entrada.utmMedium?.toLowerCase() ?? '');
  if (fonte) {
    const nome =
      fonte === 'ig' || fonte.includes('instagram')
        ? 'Instagram'
        : fonte === 'fb' || fonte.includes('facebook')
          ? 'Facebook'
          : fonte.includes('google')
            ? 'Google'
            : fonte.includes('whats')
              ? 'WhatsApp'
              : fonte.slice(0, 40);
    return pago ? `${nome} (anúncio)` : nome;
  }

  const host = hostDe(entrada.referrer);
  if (host) {
    if (HOST_PROPRIO.test(host)) return 'Interno';
    if (host.includes('instagram')) return 'Instagram';
    if (host.includes('facebook') || host === 'fb.com' || host.endsWith('.fb.com')) return 'Facebook';
    if (host.includes('google')) return 'Google';
    if (host.includes('bing')) return 'Bing';
    if (host.includes('whatsapp') || host === 'wa.me') return 'WhatsApp';
    if (host === 't.co' || host.includes('x.com') || host.includes('twitter')) return 'X';
    if (host.includes('tiktok')) return 'TikTok';
    if (host.includes('youtube')) return 'YouTube';
    return host.replace(/^www\./, '').slice(0, 60);
  }

  const app = navegadorDeApp(entrada.userAgent);
  if (app === 'instagram') return 'Instagram';
  if (app === 'facebook') return 'Facebook';
  return 'Direto';
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** /app/event/<uuid>?x=1 → /app/event/:id. Junta as páginas do mesmo tipo. */
export function normalizarCaminho(caminho: string): string {
  const semBusca = caminho.split(/[?#]/)[0] || '/';
  const limpo = semBusca.replace(UUID, ':id').replace(/\/+$/, '') || '/';
  return limpo.slice(0, 200);
}

/** Dia em Brasília, "2026-10-12": o dia do dono do site, não o do servidor. */
export const diaEmBrasilia = (quando: Date) =>
  quando.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export function visitanteDoDia(ip: string, userAgent: string, quando: Date, segredo: string): string {
  return createHmac('sha256', segredo)
    .update(`${diaEmBrasilia(quando)}|${ip}|${userAgent}`)
    .digest('hex')
    .slice(0, 16);
}

// ------------------------------------------------------------------- anotar

const COOKIE_SEM_CONTAGEM = 'dp_sem_contagem';
const segredo = () => env.VISITAS_SEGREDO ?? env.SUPABASE_SERVICE_ROLE_KEY;

const naoConta = (req: Request) => (req.headers.cookie ?? '').includes(`${COOKIE_SEM_CONTAGEM}=1`);

/**
 * O navegador do Instagram pede a mesma página duas vezes seguidas (a
 * segunda com "NV/501" no fim). Mesmo visitante na mesma página em 30
 * segundos conta uma vez só.
 */
const vistosHaPouco = new Map<string, number>();
const JANELA_MS = 30_000;

function repetida(chave: string, agora: number): boolean {
  const antes = vistosHaPouco.get(chave);
  vistosHaPouco.set(chave, agora);
  if (vistosHaPouco.size > 5000) {
    for (const [k, t] of vistosHaPouco) if (agora - t > JANELA_MS) vistosHaPouco.delete(k);
  }
  return antes !== undefined && agora - antes < JANELA_MS;
}

function anotar(req: Request, caminho: string, busca: URLSearchParams, referrer: string | null) {
  // O banco é o mesmo pra quem roda local: teste na máquina não vira visita.
  if (env.NODE_ENV !== 'production') return;
  const ua = req.get('user-agent') ?? '';
  const agora = new Date();
  const visitor = visitanteDoDia(req.ip ?? '', ua, agora, segredo());
  const path = normalizarCaminho(caminho);
  if (repetida(`${visitor}|${path}`, agora.getTime())) return;

  const linha = {
    visitor,
    path,
    source: origemDa({
      utmSource: busca.get('utm_source'),
      utmMedium: busca.get('utm_medium'),
      referrer,
      userAgent: ua,
    }),
    campaign: busca.get('utm_campaign')?.slice(0, 80) ?? null,
    device: aparelho(ua),
    in_app: navegadorDeApp(ua),
  };
  // Sem await: anotar a visita nunca atrasa nem derruba a página.
  void supabaseAdmin
    .from('page_views')
    .insert(linha)
    .then(({ error }) => {
      if (error) console.warn('[visitas] não anotou:', error.message);
    });
}

/**
 * Páginas que o servidor entrega (landing, /encontros, /termos…). As do
 * app (/app/*) ficam com o aviso do próprio app, que vê cada tela.
 */
export function contarPaginas(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' || req.path.startsWith('/app')) return next();
  // Só abertura de página: o navegador pede text/html. O fetch da landing
  // pra /events voltava 304 sem tipo e entrava como "página /events".
  if (!(req.headers.accept ?? '').includes('text/html')) return next();
  res.on('finish', () => {
    // 304 é quem voltou e o navegador já tinha a landing guardada: também
    // é visita, mas a resposta vem sem tipo — vale o caminho sem extensão.
    const html = String(res.getHeader('content-type') ?? '').includes('text/html');
    const pagina = res.statusCode === 200 ? html : res.statusCode === 304 && !/\.[a-z0-9]+$/i.test(req.path);
    if (!pagina) return;
    if (naoConta(req) || ehRobo(req.get('user-agent'))) return;
    const url = new URL(req.originalUrl, 'http://x');
    anotar(req, url.pathname, url.searchParams, req.get('referer') ?? null);
  });
  next();
}

const avisoSchema = z.object({
  caminho: z.string().startsWith('/').max(300),
  /** Só no primeiro aviso: o site anterior e a busca da URL (utm_). */
  ref: z.string().max(500).optional(),
  busca: z.string().max(1000).optional(),
});

export const visitasRouter = Router();
visitasRouter.post('/', (req, res) => {
  const aviso = avisoSchema.safeParse(req.body);
  if (aviso.success && !naoConta(req) && !ehRobo(req.get('user-agent'))) {
    anotar(req, aviso.data.caminho, new URLSearchParams(aviso.data.busca ?? ''), aviso.data.ref ?? null);
  }
  // Sempre 204: é um aviso, ninguém espera resposta.
  res.status(204).end();
});

// ------------------------------------------------------------------- resumir

export interface Visualizacao {
  at: string;
  visitor: string;
  path: string;
  source: string;
  campaign: string | null;
  device: string | null;
  in_app: string | null;
}

type Contagem = { nome: string; pessoas: number };

const ordenar = (m: Map<string, Set<string>>, limite: number): Contagem[] =>
  [...m.entries()]
    .map(([nome, s]) => ({ nome, pessoas: s.size }))
    .sort((a, b) => b.pessoas - a.pessoas || a.nome.localeCompare(b.nome))
    .slice(0, limite);

function juntar(m: Map<string, Set<string>>, chave: string, quem: string) {
  const s = m.get(chave) ?? new Set<string>();
  s.add(quem);
  m.set(chave, s);
}

/**
 * Junta as visualizações do período no que a tela mostra.
 *
 * "Pessoa" é visitante por dia: o código muda à meia-noite, então quem
 * voltou em três dias conta três. Num período de 7 dias isso é o mais
 * perto de "gente" que dá pra chegar sem guardar quem é quem.
 */
export function resumir(linhas: Visualizacao[], contasCriadas: number, dias: number, hoje = new Date()) {
  const pessoaDa = (l: Visualizacao) => `${diaEmBrasilia(new Date(l.at))}|${l.visitor}`;

  const porDia = new Map<string, { pessoas: Set<string>; visualizacoes: number }>();
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoje.getTime() - i * 86_400_000);
    porDia.set(diaEmBrasilia(d), { pessoas: new Set(), visualizacoes: 0 });
  }

  const origem = new Map<string, string>();
  const campanha = new Map<string, string>();
  const aparelhoDa = new Map<string, string>();
  const noInstagram = new Set<string>();
  const viuSite = new Set<string>();
  const abriuApp = new Set<string>();
  const foiProCadastro = new Set<string>();
  const paginas = new Map<string, Set<string>>();

  // Mais antigas primeiro: a origem de cada pessoa é a da primeira página
  // que veio de fora. Andar da landing pro app não muda de onde ela veio.
  const ordenadas = [...linhas].sort((a, b) => a.at.localeCompare(b.at));
  for (const l of ordenadas) {
    const quem = pessoaDa(l);
    const dia = porDia.get(diaEmBrasilia(new Date(l.at)));
    if (dia) {
      dia.pessoas.add(quem);
      dia.visualizacoes++;
    }
    viuSite.add(quem);
    if (l.path.startsWith('/app')) abriuApp.add(quem);
    if (/^\/app\/(login|register|entrar|welcome)$/.test(l.path)) foiProCadastro.add(quem);
    if (l.source !== 'Interno' && !origem.has(quem)) {
      origem.set(quem, l.source);
      if (l.campaign) campanha.set(quem, `${l.source} · ${l.campaign}`);
    }
    if (l.device && !aparelhoDa.has(quem)) aparelhoDa.set(quem, l.device);
    if (l.in_app === 'instagram') noInstagram.add(quem);
    juntar(paginas, l.path, quem);
  }

  const agrupar = (pares: Iterable<[string, string]>) => {
    const m = new Map<string, Set<string>>();
    for (const [quem, valor] of pares) juntar(m, valor, quem);
    return m;
  };
  // Quem só andou por dentro (abriu direto numa página e clicou) não tem
  // origem de fora: entra como Direto.
  for (const quem of viuSite) if (!origem.has(quem)) origem.set(quem, 'Direto');

  return {
    dias,
    pessoas: viuSite.size,
    visualizacoes: linhas.length,
    noInstagram: noInstagram.size,
    funil: {
      viramOSite: viuSite.size,
      abriramOApp: abriuApp.size,
      foramProCadastro: foiProCadastro.size,
      contasCriadas,
    },
    porDia: [...porDia.entries()].map(([dia, v]) => ({
      dia,
      pessoas: v.pessoas.size,
      visualizacoes: v.visualizacoes,
    })),
    origens: ordenar(agrupar(origem), 12),
    campanhas: ordenar(agrupar(campanha), 8),
    aparelhos: ordenar(agrupar(aparelhoDa), 8),
    paginas: ordenar(paginas, 15),
  };
}

// --------------------------------------------------------------------- admin

const periodoSchema = z.object({ dias: z.coerce.number().int().refine((d) => [1, 7, 30, 90].includes(d)).default(7) });

async function visualizacoesDesde(desde: string): Promise<Visualizacao[]> {
  // O Supabase entrega no máximo mil linhas por pedido: busca em páginas.
  const linhas: Visualizacao[] = [];
  for (let pagina = 0; pagina < 100; pagina++) {
    const { data, error } = await supabaseAdmin
      .from('page_views')
      .select('at, visitor, path, source, campaign, device, in_app')
      .gte('at', desde)
      .order('id')
      .range(pagina * 1000, pagina * 1000 + 999);
    if (error) throw error;
    linhas.push(...((data ?? []) as Visualizacao[]));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

export const adminTrafegoRouter = Router();
adminTrafegoRouter.use(requireAuth, requireAdmin);
adminTrafegoRouter.get('/', async (req, res, next) => {
  try {
    const { dias } = periodoSchema.parse(req.query);
    // Desde a meia-noite (Brasília) de N-1 dias atrás.
    const agora = new Date();
    const primeiroDia = diaEmBrasilia(new Date(agora.getTime() - (dias - 1) * 86_400_000));
    const desde = new Date(`${primeiroDia}T00:00:00-03:00`).toISOString();

    const [linhas, contas] = await Promise.all([
      visualizacoesDesde(desde),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', desde),
    ]);
    if (contas.error) throw contas.error;

    // Este aparelho é de quem administra: sai da contagem daqui pra frente.
    res.cookie(COOKIE_SEM_CONTAGEM, '1', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 86_400_000,
    });
    sendSuccess(res, resumir(linhas, contas.count ?? 0, dias, agora));
  } catch (err) {
    next(err);
  }
});
