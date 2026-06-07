
import { AppError } from '../utils/errors.js';

export const validate = (schema)=>(req,res,next)=>{
    const result = schema.safeParse(req.body);

    if(!result.success){
        const message = result.error.issues.map((issue)=>`${issue.path.join('.')}:${issue.message}`).join(';');
        return next (new AppError(message,400));
    }

    req.body = result.data;
    next();
};