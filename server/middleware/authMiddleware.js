import { verifyToken } from '../services/authService.js';
import { AUTH_COOKIE_NAME } from '../config/constants.js';
import { AppError } from '../utils/errors.js';

export const authMiddleware = (req,res,next)=>{
    try{
        const token = req.cookies?.[AUTH_COOKIE_NAME];

        if(!token){
            throw new AppError('Not authenticated',401);
        }
        const decoded = verifyToken(token);
        req.userId = decoded.userId;
        next();
    }
    catch(err){
        next(new AppError('Not authenticated',401));
    }
};