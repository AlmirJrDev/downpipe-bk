import { Router } from 'express';
import { register, login, logout, forgotPassword, refresh } from './auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);

export default router;
