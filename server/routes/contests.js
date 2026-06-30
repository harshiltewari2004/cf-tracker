import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  getContestList,
  getContestById,
} from "../controllers/ContestController.js";

const router = Router();

router.get("/", authMiddleware, getContestList);
router.get("/:cfContestId", authMiddleware, getContestById);

export default router;
