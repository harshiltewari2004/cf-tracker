import {generatePlan, markSolved,replaceProblem} from '../engines/DailyPlanEngine.js';

export const getTodaysPlan = async(req, res, next)=>{
    try{
        const plan = await generatePlan(req.userId,new Date());
        res.json({success:true,data:plan});
    }
    catch(err){
        next(err);
    }
};

export const markProblemSolved = async(req,res,next)=>{
    try{
        const plan = await markSolved(req.userId,req.params.id);
        res.json({success:true,data:plan});
    }
    catch(err){
        next(err);
    }
};

export const markProblemReplaced = async (req, res, next) => {
  try {
    const plan = await replaceProblem(req.userId, req.params.id);
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
};