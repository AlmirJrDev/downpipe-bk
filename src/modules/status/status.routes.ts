import { Router } from 'express';
import { page, logo, publishSession, endSession } from './status.controller';

const router = Router();

// Página pública (o link que vai pros testadores).
router.get('/', page);
router.get('/logo.png', logo);

// Publicação da sessão pelo script do app — exige x-status-secret.
router.post('/session', publishSession);
router.delete('/session', endSession);

export default router;
