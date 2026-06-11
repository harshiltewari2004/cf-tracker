import Redis from 'ioredis';

import { env } from './env.js';
import { logger } from './logger.js';

export const connection = new Redis(env.REDIS_URL,{
    maxRetriesPerRequest:null
});

connection.on('connect',()=>{
    logger.info('Redis connected');
});

connection.on('reconnecting',()=>{
    logger.warn('Redis reconnecting');
});

connection.on('error',(err)=>{
    logger.error({err},'Redis connection error');
});