import {generatePlan} from '../engines/DailyPlanEngine.js';

export const getTodaysPlan = async(req, res, next)=>{
    try{
        const plan = await generatePlan(req.userId,new Date());
        res.json({success:true,data:plan});
    }
    catch(err){
        next(err);
    }
};