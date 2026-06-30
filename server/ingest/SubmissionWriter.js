import Submission from '../models/Submission.js';
import TopicBucketScore from '../models/TopicBucketScore.js';
import logger from '../config/logger.js';
import { MONGO_DUPLICATE_KEY_CODE } from '../config/constants.js';

export const writeSubmission = async(submission,context)=>{
    switch (submission.participantType){
        case 'PRACTICE':
            return writePracticeSubmission(submission,context);
        case 'CONTESTANT':
            throw new Error('CONTESTANT path not implemented yet');
        case 'VIRTUAL':
            throw new Error(`Unknown participantType :${submission.participantType}`);
    }
};

const writePracticeSubmission = async(submission,context)=>{
    const {userId,problem} = context;

    try{
        await Submission.create(submission);
    }
    catch(err){
        if(err.code===MONGO_DUPLICATE_KEY_CODE){
            return;
        }
        throw err;
    }

    if(submission.verdict!=='OK'){
        return;
    }
    for(const tag of problem.tags){
        await TopicBucketScore.updateOne(
            {user:userId,topic:tag,bucket:problem.ratingBucket},
            {$inc:{solves:1}},
            {upsert:true}
        );
    }

};