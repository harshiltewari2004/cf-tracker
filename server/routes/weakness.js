import { Router } from "express";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { getWeaknessScores, getLedger  } from "../controllers/weaknessController.js";

const router = Router();

router.get("/", authMiddleware, getWeaknessScores);
router.get("/ledger", authMiddleware, getLedger);
export default router;
