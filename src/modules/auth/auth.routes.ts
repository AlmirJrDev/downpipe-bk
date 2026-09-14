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

const router = Router();

router.post('/register', limiteCadastro, register);
router.post('/login', limiteLoginPorIp, limiteLoginPorConta, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', limiteRecuperacaoPorIp, limiteRecuperacaoPorConta, forgotPassword);
// requireAuth de propósito: quem chega aqui traz o token do e-mail de
// recuperação, que vale como autenticação.
router.patch('/password', requireAuth, resetPassword);

export default router;
