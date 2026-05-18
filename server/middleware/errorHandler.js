import logger from '../config/logger.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  
  if (err instanceof AppError && err.isOperational) {
    logger.warn(
      { err: { message: err.message, statusCode: err.statusCode }, path: req.path, userId: req.userId },
      'operational error'
    );
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }


  logger.error(
    { err, path: req.path, userId: req.userId },
    'unexpected error'
  );

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
 
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFoundHandler = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.path}`, 404));
};