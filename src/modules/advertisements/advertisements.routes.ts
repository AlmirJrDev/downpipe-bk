import { Router } from 'express';
import { listActive } from './advertisements.controller';

const router = Router();

router.get('/active', listActive);

export default router;
