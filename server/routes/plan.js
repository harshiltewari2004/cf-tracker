import {Router } from 'express';

import {authMiddleware} from '../middleware/authMiddleware.js';
import {getTodaysPlan} from '../controllers/planController.js';

const router = Router();

router.get('/today',authMiddleware,getTodaysPlan);

export default router;