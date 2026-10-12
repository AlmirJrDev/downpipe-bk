/**
 * Entrar com o Google.
 *
 * Quem faz o login de verdade é o Supabase Auth: o servidor só monta o
 * endereço de ida — pro Supabase, que leva ao Google — e diz pro app se o
 * Google está ligado. A conta nova ganha o perfil pela mesma trigger do
 * cadastro por e-mail (handle_new_user), com @ provisório, e cai nas
 * boas-vindas pra escolher o dela.
 *
 * Na volta o Supabase devolve a sessão no fragmento do endereço
 * (#access_token=...&refresh_token=...), que a tela /app/entrar lê e guarda.
 * A renovação depois é a mesma de sempre (/auth/refresh).
 */
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

/** O endereço do Supabase que leva pro Google e volta pro app. */
export function enderecoDeIdaProGoogle(origem: string, voltar: string | null): string {
  const retorno = new URL('/app/entrar', origem);
  if (voltar) retorno.searchParams.set('voltar', voltar);
  const ida = new URL('/auth/v1/authorize', env.SUPABASE_URL);
  ida.searchParams.set('provider', 'google');
  ida.searchParams.set('redirect_to', retorno.toString());
  return ida.toString();
}

/**
 * Quais logins sociais estão ligados no Supabase. É o que decide se o app
 * mostra o botão: ligar o Google no painel do Supabase basta pra ele
 * aparecer, sem novo deploy — e enquanto não estiver ligado, ninguém clica
 * num botão que daria erro.
 *
 * Guardado por 5 minutos: a resposta quase nunca muda, e a tela de login é
 * a mais aberta do app.
 */
let cache: { google: boolean; em: number } | null = null;
const VALIDADE_MS = 5 * 60_000;

export async function provedoresLigados(): Promise<{ google: boolean }> {
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
