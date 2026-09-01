import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { register, login, logout, forgotPassword, resetPassword, refresh } from './auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
// requireAuth de propósito: quem chega aqui traz o token do e-mail de
// recuperação, que vale como autenticação.
router.patch('/password', requireAuth, resetPassword);

export default router;
