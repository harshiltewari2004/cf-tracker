import {Router } from 'express';

import {authMiddleware} from '../middleware/authMiddleware.js';
import {getTodaysPlan} from '../controllers/planController.js';
import { markProblemSolved } from '../controllers/planController.js';

const router = Router();

router.get('/today',authMiddleware,getTodaysPlan);

router.post('/problems/:id/solved', authMiddleware, markProblemSolved);

export default router;