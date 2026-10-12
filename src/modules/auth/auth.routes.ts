import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { register, login, logout, forgotPassword, resetPassword, refresh } from './auth.controller';
import {
  limiteCadastro,
  limiteLoginPorConta,
  limiteLoginPorIp,
  limiteRecuperacaoPorConta,
  limiteRecuperacaoPorIp,
} from '@/shared/middleware/rateLimit.middleware';
import { env } from '@/config/env';
import { sendSuccess } from '@/shared/utils/apiResponse';
import {
  abrirViagem,
  COOKIE_DA_VIAGEM,
  concluirComGoogle,
  enderecoDeIdaProGoogle,
  enderecoDoGoogle,
  googleDireto,
  lerCookie,
  novaViagem,
  provedoresLigados,
  retornoDoGoogle,
  selarViagem,
  voltarSeguro,
} from './loginSocial';

// O cookie da viagem só precisa ir e voltar do Google: vive 10 minutos e
// só é mandado pra /auth/google*. Lax deixa ele voltar no redirecionamento
// do Google (navegação de topo), mas não em requisições de outros sites.
const opcoesDoCookie = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/auth/google',
};

const router = Router();

router.post('/register', limiteCadastro, register);
router.post('/login', limiteLoginPorIp, limiteLoginPorConta, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', limiteRecuperacaoPorIp, limiteRecuperacaoPorConta, forgotPassword);
// Login social (ver loginSocial.ts): o app pergunta o que está ligado, e
// o botão do Google leva pra cá, que manda direto pro Google (ou, sem as
// credenciais, pro Supabase).
const origemDo = (req: { protocol: string; get(h: string): string | undefined }) =>
  env.APP_URL ?? `${req.protocol}://${req.get('host')}`;

router.get('/providers', async (_req, res, next) => {
  try {
    sendSuccess(res, await provedoresLigados());
  } catch (err) {
    next(err);
  }
});
router.get('/google', (req, res) => {
  const origem = origemDo(req);
  const voltar = voltarSeguro(req.query.voltar);
  if (!googleDireto()) {
    res.redirect(302, enderecoDeIdaProGoogle(origem, voltar));
    return;
  }
  const viagem = novaViagem(voltar);
  res.cookie(COOKIE_DA_VIAGEM, selarViagem(viagem, env.GOOGLE_CLIENT_SECRET!), {
    ...opcoesDoCookie,
    maxAge: 10 * 60_000,
  });
  res.redirect(302, enderecoDoGoogle(env.GOOGLE_CLIENT_ID!, retornoDoGoogle(origem), viagem));
});
router.get('/google/callback', async (req, res) => {
  const origem = origemDo(req);
  const viagem = googleDireto()
    ? abrirViagem(lerCookie(req.headers.cookie, COOKIE_DA_VIAGEM), env.GOOGLE_CLIENT_SECRET!)
    : null;
  // Uso único: a mesma volta não serve duas vezes.
  res.clearCookie(COOKIE_DA_VIAGEM, opcoesDoCookie);
  // A sessão vai no fragmento, que o navegador não reenvia a ninguém; e
  // sem cache, pra o redirecionamento não ficar guardado em lugar nenhum.
  res.set('Cache-Control', 'no-store');
  try {
    res.redirect(302, await concluirComGoogle(origem, req.query.code, req.query.state, viagem));
  } catch {
    res.redirect(302, `${origem}/app/entrar#error_description=falhou`);
  }
});

// requireAuth de propósito: quem chega aqui traz o token do e-mail de
// recuperação, que vale como autenticação.
router.patch('/password', requireAuth, resetPassword);

export default router;
