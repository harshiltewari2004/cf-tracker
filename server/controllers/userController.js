import * as userService from '../services/userService.js';
import { AUTH_COOKIE_NAME } from '../config/constants.js';
import { env } from '../config/env.js';
import { success } from 'zod';

const isProd = env.NODE_ENV=='production';

export const updateHandle = async(req , res , next)=>{
    try{
        const { handle } = req.body;
        const profile = await userService.updateHandle(req.userId,handle);
        res.status(200).json({success:true,data:profile});
    }
    catch(err){
        next(err);
    }
};

export const deleteAccount = async(req,res,next)=>{
    try{
        await userService.deleteAccount(req.userId);

        res.clearCookie(AUTH_COOKIE_NAME,{
            httpOnly:true,
            secure:isProd,
            sameSite:isProd?'none':'lax'
        });

        res.status(200).json({success:true,data:null});
    }
    catch(err){
        next(err);
    }
};