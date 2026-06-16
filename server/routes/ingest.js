import { Router }from 'express';

import {authMiddleware} from '../middleware/authMiddleware.js';

import * as ingestController from '../controllers/ingestController.js';

const router = Router();

router.get('/status',authMiddleware,ingestController.getStatus);

export default router;