import User from "../models/User.js";
import { AppError } from "../utils/errors.js";
import { env } from "../config/env.js";
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE_MS,
} from "../config/constants.js";
import * as authService from "../services/authService.js";

const isProd = env.NODE_ENV === "production";

const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  });
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      throw new AppError("Email already registered", 409);
    }
    const passwordHash = await authService.hashPassword(password);
    const user = await User.create({ name, email, passwordHash });

    const token = authService.signToken(user._id);
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      data: authService.toAuthUser(user),
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await authService.login(email, password);

    const token = authService.signToken(user._id);
    setAuthCookie(res, token);

    res.status(200).json({
      success: true,
     data: authService.toAuthUser(user),
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
    });
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};

export const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("name email onboardingCompleted").lean();
    if (!user) {
      throw new AppError("User not found", 404);
    }
    res
      .status(200)
      .json({
        success: true,
        data: authService.toAuthUser(user),
      });
  } catch (err) {
    next(err);
  }
};
