import {Queue} from 'bullmq';
import logger from '../config/logger.js';
import {connection} from '../config/redis.js';

import{
    INGEST_QUEUE_NAME,
    INGEST_JOB_INITIAL,
    INGEST_JOB_DAILY_REFRESH,
    INGEST_JOB_ATTEMPTS,
    INGEST_BACKOFF_DELAY_MS,
    INGEST_KEEP_COMPLETED,
    INGEST_KEEP_FAILED
} from '../config/constants.js';

import IngestJob from '../models/IngestJob.js';

const ingestQueue = new Queue(INGEST_QUEUE_NAME,{
    connection,
    defaultJobOptions:{
        attempts:INGEST_JOB_ATTEMPTS,
        backoff:{type:'exponential',delay:'INGEST_BACKOFF_DELAY_MS'},
        removeOnComplete:{count:INGEST_KEEP_COMPLETED},
    },
});

const enqueue = async({userId,jobName})=>{
    const job = await IngestJob.create({
        user:userId,
        type:jobName,
        status:'queued',
    });

    await ingestQueue.add(jobName,{
        userId:userId.toString(),
        ingestJobId:job._id.toString(),
    });

    logger.info(
        {userId:userId.toString(),ingestJobId:job._id.toString(),type:jobName},
        'ingest job queued'
    );

    return job;
};

export const enqueueInitialIngest = ({userId})=>
    enqueue({userId,jobName:INGEST_JOB_INITIAL});

export const enqueueDailyRefresh =({userId})=>
    enqueue({userId,jobName:INGEST_JOB_DAILY_REFRESH});

export default ingestQueue;