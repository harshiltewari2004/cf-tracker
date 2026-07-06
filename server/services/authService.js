import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { BCRYPT_COST_FACTOR } from "../config/constants.js";
import { email } from "zod";
import User from "../models/User.js";
import { AppError } from "../utils/errors.js";

export const hashPassword = async (plainPassword) => {
  return bcrypt.hash(plainPassword, BCRYPT_COST_FACTOR);
};

export const comparePassword = async (plainPassword, passwordHash) => {
  return bcrypt.compare(plainPassword, passwordHash);
};

export const signToken = (userId) => {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};

export const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

const DUMMY_HASH = bcrypt.hashSync("cf-tracker-dummy", BCRYPT_COST_FACTOR);

export const login = async (email, password) => {
  const user = await User.findOne({ email }).select("+passwordHash");
  const hashToCheck = user ? user.passwordHash : DUMMY_HASH;
  const passwordMatches = await bcrypt.compare(password, hashToCheck);

  if (!user || !passwordMatches) {
    throw new AppError("Invalid credentials", 401);
  }
  return user;
};

export const toAuthUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  onboardingCompleted: user.onboardingCompleted,
});
