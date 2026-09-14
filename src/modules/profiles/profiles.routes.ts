import { Router } from 'express';
import { requireAuth, attachUserIfPresent } from '@/shared/middleware/auth.middleware';
import { imageUpload } from '@/shared/middleware/upload.middleware';
import { getMe, updateMe, getByUsername, uploadAvatar, deleteMe } from './profiles.controller';

// Rotas privadas: /profile/me
export const meRouter = Router();
meRouter.get('/me', requireAuth, getMe);
meRouter.patch('/me', requireAuth, updateMe);
meRouter.post('/me/avatar', requireAuth, imageUpload, uploadAvatar);
// POST e não DELETE: leva a confirmação no corpo, e o cliente do app só
// manda corpo em POST/PATCH.
meRouter.post('/me/delete', requireAuth, deleteMe);

// Rotas públicas: /profiles/:username
export const publicProfilesRouter = Router();
publicProfilesRouter.get('/:username', attachUserIfPresent, getByUsername);
