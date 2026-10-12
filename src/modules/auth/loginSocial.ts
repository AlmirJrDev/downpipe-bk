/**
 * Entrar com o Google.
 *
 * Dois caminhos, conforme a configuração:
 *
 * - **Direto (com GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET):** o servidor
 *   manda a pessoa pro Google com a volta em downpipe.com.br/auth/google/
 *   callback, troca o código pelo ID token do Google e entrega esse token
 *   ao Supabase (signInWithIdToken), que devolve a sessão de sempre. A tela
 *   de escolher a conta diz "Prosseguir para downpipe.com.br".
 *
 * - **Pelo Supabase (sem as credenciais):** o authorize do Supabase faz
 *   tudo, mas a tela do Google mostra "ptkjgfyfduvwubpraeud.supabase.co" —
 *   que pra quem não conhece parece golpe. Fica como reserva.
 *
 * Nos dois, a conta nova ganha o perfil pela trigger handle_new_user (@
 * provisório → boas-vindas) e a sessão chega ao app no fragmento de
 * /app/entrar, que guarda e apaga da barra.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

/**
 * Pra onde voltar depois de entrar, quando a pessoa tinha aberto algum
 * link. Só caminho dentro do app: um endereço completo aqui viraria um
 * redirecionamento aberto pra qualquer site.
 */
export function voltarSeguro(voltar: unknown): string | null {
  if (typeof voltar !== 'string') return null;
  if (!voltar.startsWith('/') || voltar.startsWith('//') || voltar.includes('\\')) return null;
  if (voltar.length > 300) return null;
  return voltar;
}

export function googleDireto(): boolean {
  return !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
}

/** Caminho reserva: o authorize do Supabase leva pro Google e volta pro app. */
export function enderecoDeIdaProGoogle(origem: string, voltar: string | null): string {
  const retorno = new URL('/app/entrar', origem);
  if (voltar) retorno.searchParams.set('voltar', voltar);
  const ida = new URL('/auth/v1/authorize', env.SUPABASE_URL);
  ida.searchParams.set('provider', 'google');
  ida.searchParams.set('redirect_to', retorno.toString());
  return ida.toString();
}

// --------------------------------------------------------------- caminho direto

/**
 * O que precisa sobreviver à ida e volta pelo Google: o state (prova de que
 * a volta é desta ida, contra CSRF), o nonce (amarra o ID token a esta ida)
 * e o caminho de volta. Vai num cookie assinado, que só este servidor lê.
 */
export interface Viagem {
  state: string;
  nonce: string;
  voltar: string | null;
  expira: number;
}

export const COOKIE_DA_VIAGEM = 'dp_google';
const VALIDADE_DA_VIAGEM_MS = 10 * 60_000;

const b64url = (b: Buffer) => b.toString('base64url');
const assinar = (texto: string, segredo: string) => b64url(createHmac('sha256', segredo).update(texto).digest());

export function selarViagem(v: Viagem, segredo: string): string {
  const corpo = b64url(Buffer.from(JSON.stringify(v)));
  return `${corpo}.${assinar(corpo, segredo)}`;
}

export function abrirViagem(selada: string | undefined, segredo: string, agora = Date.now()): Viagem | null {
  if (!selada) return null;
  const [corpo, assinatura] = selada.split('.');
  if (!corpo || !assinatura) return null;
  const esperada = Buffer.from(assinar(corpo, segredo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
  try {
    const v = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as Viagem;
    return v.expira > agora ? v : null;
  } catch {
    return null;
  }
}

export function novaViagem(voltar: string | null, agora = Date.now()): Viagem {
  return {
    state: b64url(randomBytes(24)),
    nonce: b64url(randomBytes(24)),
    voltar,
    expira: agora + VALIDADE_DA_VIAGEM_MS,
  };
}

/** O Google recebe o hash do nonce; o Supabase recebe o nonce cru e confere. */
export const hashDoNonce = (nonce: string) => createHash('sha256').update(nonce).digest('hex');

export function enderecoDoGoogle(clientId: string, retorno: string, viagem: Viagem): string {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', retorno);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('state', viagem.state);
  u.searchParams.set('nonce', hashDoNonce(viagem.nonce));
  // Sempre a tela de escolher a conta: quem tem duas contas Google no
  // navegador entraria na errada sem perceber.
  u.searchParams.set('prompt', 'select_account');
  return u.toString();
}

export const retornoDoGoogle = (origem: string) => new URL('/auth/google/callback', origem).toString();

/** Lê um cookie do cabeçalho, sem depender de cookie-parser. */
export function lerCookie(cabecalho: string | undefined, nome: string): string | undefined {
  if (!cabecalho) return undefined;
  for (const parte of cabecalho.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/**
 * A volta do Google: troca o código pelo ID token e o ID token pela sessão
 * do Supabase. Devolve o endereço final do app — com a sessão no
 * fragmento, ou com o erro.
 */
export async function concluirComGoogle(
  origem: string,
  code: unknown,
  state: unknown,
  viagem: Viagem | null
): Promise<string> {
  const entrar = new URL('/app/entrar', origem);
  const falhou = (motivo: string) => `${entrar.toString()}#error_description=${encodeURIComponent(motivo)}`;

  if (!viagem || typeof state !== 'string' || state !== viagem.state) return falhou('viagem expirada');
  if (typeof code !== 'string' || !code) return falhou('sem codigo');

  const troca = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: retornoDoGoogle(origem),
      grant_type: 'authorization_code',
    }),
  });
  const tokens = (await troca.json().catch(() => ({}))) as { id_token?: string };
  if (!troca.ok || !tokens.id_token) return falhou('troca recusada');

  // Cliente próprio por login: a sessão fica na memória do cliente, e o
  // compartilhado misturaria logins simultâneos.
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: tokens.id_token,
    nonce: viagem.nonce,
  });
  if (error || !data.session) return falhou('supabase recusou');

  if (viagem.voltar) entrar.searchParams.set('voltar', viagem.voltar);
  const fragmento = new URLSearchParams({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: String(data.session.expires_at ?? ''),
  });
  return `${entrar.toString()}#${fragmento.toString()}`;
}

// ---------------------------------------------------------- provedores ligados

/**
 * Se o botão do Google aparece. Com o caminho direto configurado, aparece;
 * sem ele, depende de o Google estar ligado no painel do Supabase.
 *
 * Guardado por 5 minutos: a resposta quase nunca muda, e a tela de login é
 * a mais aberta do app.
 */
let cache: { google: boolean; em: number } | null = null;
const VALIDADE_MS = 5 * 60_000;

export async function provedoresLigados(): Promise<{ google: boolean }> {
  if (googleDireto()) return { google: true };
  if (cache && Date.now() - cache.em < VALIDADE_MS) return { google: cache.google };
  try {
    const r = await fetch(new URL('/auth/v1/settings', env.SUPABASE_URL), {
      headers: { apikey: env.SUPABASE_ANON_KEY },
    });
    const j = (await r.json()) as { external?: { google?: boolean } };
    cache = { google: !!j.external?.google, em: Date.now() };
  } catch {
    // Sem resposta do Supabase, o botão some: melhor que um botão quebrado.
    return { google: false };
  }
  return { google: cache.google };
}
