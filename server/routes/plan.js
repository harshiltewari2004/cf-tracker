import { Router } from "express";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { getTodaysPlan } from "../controllers/planController.js";
import {
  markProblemSolved,
  markProblemReplaced,
} from "../controllers/planController.js";

const router = Router();

router.get("/today", authMiddleware, getTodaysPlan);

router.post("/problems/:id/solved", authMiddleware, markProblemSolved);

router.post("/problems/:id/replace", authMiddleware, markProblemReplaced);

export default router;
