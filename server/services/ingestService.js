import CFProfile from '../models/CFProfile.js';
import IngestJob from '../models/IngestJob.js';

export const getIngestStatus=async(userId)=>{
    const profile = await CFProfile.findOne({user:userId})
    .select('ingestStatus')
    .lean();

    if(!profile){
        return {status:'not_started',submissionsIngested:0};
    }
    const latestJob = await IngestJob.findOne({user:userId})
    .select('submissionsIngested')
    .sort({createdAt:-1})
    .lean();

    return{
        status:profile.ingestStatus,
        submissionsIngested:latestJob?.submissionsIngested??0,
    };
};