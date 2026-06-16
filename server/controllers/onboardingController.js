import { success } from 'zod';
import * as onboardingService from '../services/onboardingService.js';

export const submitHandle = async(req,res,next)=>{
    try{
        const data = await onboardingService.submitHandle(req.userId,req.body.handle);
        res.json({success:true,data});
    }
    catch(err){
        next(err);
    }
};

export const getStatus = async(req,res,next)=>{
    try{
        const data = await onboardingService.getOnboardingStatus(req.userId);
        res.json({success:true,data});
    }
    catch(err){
        next(err);
    }
};