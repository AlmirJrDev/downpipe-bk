import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { search, reverse } from './geocoding.controller';

// Rota em /geocoding
const router = Router();

// requireAuth de propósito: a busca consome a cota do Nominatim, e não há
// motivo para expor isso a quem não está criando um evento.
router.get('/search', requireAuth, search);

// Mesmo motivo do requireAuth acima: consome a mesma cota do Nominatim.
router.get('/reverse', requireAuth, reverse);

export default router;
