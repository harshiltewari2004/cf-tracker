import {Router } from 'express';

import {authMiddleware} from '../middleware/authMiddleware.js';
import {getWeaknessScores} from '../controllers/weaknessController.js';

const router = Router();

router.get('/',authMiddleware,getWeaknessScores);

export default router;