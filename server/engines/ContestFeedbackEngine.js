import Upsolvequeue from '../models/UpsolveQueue.js';
import {UPSOLVE_SCHEDULE_DELAY_MS} from '../config/constants.js';

const KEY_SEP='|';

const makeKey = (topic, bucket)=>`${topic}${KEY_SEP}${bucket}`;

const mergeDelta = (map,topic,bucket,deltaFails,deltaOpportunities)=>{
    const key = makeKey(topic,bucket);
    const existing = map.get(key);

    if(existing){
        existing.contestFails+=deltaFails;
        existing.contestOpportunities+=deltaOpportunities;
    }
    else{
        map.set(key,{
            topic,
            bucket,
            contestFails:deltaFails,
            contestOpportunities:deltaOpportunities,
        });
    }
};

const extractContestFails = (abProblems,failedProblems)=>{
    const deltas = new Map();

    for(const problem of abProblems){
        const {ratingBucket}=problem;
        for(const tag of problem.tags){
            mergeDelta(deltas,tag,ratingBucket,0,1);
        }
    }
    for(const problem of failedProblems){
        const {ratingBucket}=problem;
        for(const tag of problem.tags){
            mergeDelta(deltas,tag,ratingBucket,1,0);
        }
    }
    return deltas;
};

const seedUpsolveQueue = async(
    userId,
    signupDate,
    cfContestId,
    contestStartTime,
    failedProblems
)=>{
    if(contestStartTime<signupDate){
        return 0;
    }
    const addedAt = new Date();
    const scheduledFor = new Date(addedAt.getTime()+UPSOLVE_SCHEDULE_DELAY_MS);

    let seeded = 0;

    for(const problem of failedProblems ){
        await Upsolvequeue.findOneAndUpdate(
            {user:userId,problem:problem._id},
            {
                $setOnInsert:{
                    user:userId,
                    problem:problem._id,
                    sourceContestId:cfContestId,
                    addedAt,
                    scheduledFor,
                    status:'pending',
                },
            },
            {upsert:true}
        );
        seeded+=1;
    }
    return seeded;
};

export {extractContestFails,seedUpsolveQueue};