import cron from 'node-cron';

import logger from '../config/logger.js';
import {BENCHMARK_REFRESH_CRON,CRON_TIMEZONE} from '../config/constants.js';
import {refresh } from '../engines/BenchmarkEngine.js';

export const runBenchmarkRefresh = async()=>{
    try{
        logger.info('benchmark refresh:starting cohort scan');
        await refresh();
        logger.info('benchmark refresh:complete');
    }
    catch(err){
        logger.error({err},'benchmark refresh:failed');
    }
};  

export const scheduleBenchmarkRefresh=()=>{
    cron.schedule(BENCHMARK_REFRESH_CRON,runBenchmarkRefresh,{timezone:CRON_TIMEZONE});
};

