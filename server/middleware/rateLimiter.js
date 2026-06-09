import rateLimit from 'express-rate-limit';

import{
    RATE_LIMIT_WINDOW_MS,
    AUTH_RATE_LIMIT_MAX,
    API_RATE_LIMIT_MAX,
} from '../config/constants.js';

export const authLimiter = rateLimit({
    windowMs:RATE_LIMIT_WINDOW_MS,
    max:API_RATE_LIMIT_MAX,
    standardHeaders:true,
    legacyHeaders:false,
    message:{success:false,message:'Too many requests,please try again later'},
});

export const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: API_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});