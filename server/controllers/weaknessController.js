import {getWeakness} from '../engines/GapEngine.js';

export const getWeaknessScores = async(req,res,next)=>{
    try{
        const data = await getWeakness(req.userId);
        res.json({success:true,data});
    }
    catch(err){
        next(err);
    }
};