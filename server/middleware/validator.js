import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import {CF_HANDLE,USER_NAME,PASSWORD} from '../config/constants.js';


export const validate = (schema)=>(req,res,next)=>{
    const result = schema.safeParse(req.body);

    if(!result.success){
        const message = result.error.issues.map((issue)=>`${issue.path.join('.')}:${issue.message}`).join(';');
        return next (new AppError(message,400));
    }

    req.body = result.data;
    next();
};

export const handleSchema = z.object({
    handle:z
    .string()
    .min(CF_HANDLE.MIN_LENGTH)
    .max(CF_HANDLE.MAX_LENGTH)
    .regex(CF_HANDLE.REGEX,'Handle may only contain letters digits and underscores'),
});

export const registerSchema = z.object({
  name: z.string().min(USER_NAME.MIN_LENGTH).max(USER_NAME.MAX_LENGTH),
  email: z.email(),
  password: z.string().min(PASSWORD.MIN_LENGTH).max(PASSWORD.MAX_LENGTH),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});