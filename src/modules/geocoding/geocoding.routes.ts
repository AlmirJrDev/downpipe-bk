import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { search } from './geocoding.controller';

// Rota em /geocoding
const router = Router();

// requireAuth de propósito: a busca consome a cota do Nominatim, e não há
// motivo para expor isso a quem não está criando um evento.
router.get('/search', requireAuth, search);

export default router;
