import { Router } from "express";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { validate, handleSchema } from "../middleware/validator.js";
import * as onboardingController from "../controllers/onboardingController.js";

const router = Router();

router.post(
  "/codeforces",
  authMiddleware,
  validate(handleSchema),
  onboardingController.submitHandle,
);

router.get("/status", authMiddleware, onboardingController.getStatus);

export default router;
