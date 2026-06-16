import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import {CF_HANDLE} from '../config/constants.js';


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