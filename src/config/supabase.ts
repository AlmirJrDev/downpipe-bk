import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Client "anon": usado para operações que devem respeitar Row Level Security
 * como se fossem feitas pelo próprio usuário autenticado (ex.: validar o JWT
 * recebido do app, leituras públicas).
 */
export const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Client "service role": usado apenas no backend para operações administrativas
 * e escritas que passam pela camada de regra de negócio (services), que por sua
 * vez são responsáveis por garantir que owner_id/author_id venha do usuário
 * autenticado, nunca do body da requisição.
 *
 * NUNCA exportar/expor essa key para o frontend.
 */
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Cria um client Supabase "no contexto do usuário": usa a anon key mas injeta
 * o JWT do usuário no header Authorization, para que políticas de RLS baseadas
 * em auth.uid() funcionem corretamente em leituras que devem respeitar RLS.
 */
export function createUserScopedClient(accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
