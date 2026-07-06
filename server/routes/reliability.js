import { Router } from "express";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { getReliabilityScore } from "../controllers/reliabilityController.js";

const router = Router();

router.get("/", authMiddleware, getReliabilityScore);

export default router;
