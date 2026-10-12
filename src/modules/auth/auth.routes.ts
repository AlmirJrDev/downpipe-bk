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
import { enderecoDeIdaProGoogle, provedoresLigados, voltarSeguro } from './loginSocial';

const router = Router();

router.post('/register', limiteCadastro, register);
router.post('/login', limiteLoginPorIp, limiteLoginPorConta, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', limiteRecuperacaoPorIp, limiteRecuperacaoPorConta, forgotPassword);
// Login social (ver loginSocial.ts): o app pergunta o que está ligado, e
// o botão do Google leva pra cá, que manda pro Supabase.
router.get('/providers', async (_req, res, next) => {
  try {
    sendSuccess(res, await provedoresLigados());
  } catch (err) {
    next(err);
  }
});
router.get('/google', (req, res) => {
  const origem = env.APP_URL ?? `${req.protocol}://${req.get('host')}`;
  res.redirect(302, enderecoDeIdaProGoogle(origem, voltarSeguro(req.query.voltar)));
});

// requireAuth de propósito: quem chega aqui traz o token do e-mail de
// recuperação, que vale como autenticação.
router.patch('/password', requireAuth, resetPassword);

export default router;
