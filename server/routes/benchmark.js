import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getBenchmarkMeta } from '../controllers/benchmarkController.js';

const router = Router();
router.get('/', authMiddleware, getBenchmarkMeta);

export default router;