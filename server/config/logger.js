import pino from 'pino';
import { env } from './env.js';

const logger = pino({
  level: env.LOG_LEVEL,
  
  transport: env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  

  redact: {
    paths: ['password', 'passwordHash', '*.password', 'req.headers.cookie', 'req.headers.authorization'],
    censor: '[REDACTED]',
  },
});

export default logger;