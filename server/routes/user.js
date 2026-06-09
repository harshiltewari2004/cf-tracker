import express from 'express';
import { z } from 'zod';

import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validator.js';
import {updateHandle,deleteAccount} from '../controllers/userController.js';

const router = express.Router();

const updateHandleSchema = z.object({
    handle:z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
});

router.patch('/handle',authMiddleware,validate(updateHandleSchema),updateHandle);
router.delete('/account',authMiddleware,deleteAccount);

export default router;