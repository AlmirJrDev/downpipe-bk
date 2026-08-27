import { Router } from 'express';
import {
  listBrands,
  listModelsByBrand,
  listYearsByModel,
  getById,
  search,
} from './vehicle-catalog.controller';

const router = Router();

// IMPORTANTE: /search precisa vir antes de /:id para não ser capturada
// como parâmetro de rota.
router.get('/brands', listBrands);
router.get('/brands/:brandId/models', listModelsByBrand);
router.get('/models/:modelId/years', listYearsByModel);
router.get('/search', search);
router.get('/:id', getById);

export default router;
