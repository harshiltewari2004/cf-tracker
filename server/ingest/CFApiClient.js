import axios from "axios";
import Bottleneck from 'bottleneck';

import {env} from '../config/env.js';
import logger from '../config/logger.js';
import { AppError } from '../utils/errors.js';

const cfApi = axios.create({
    baseURL:'https://codeforces.com/api',
    timeout:15000,
});

const limiter = new Bottleneck({
    minTime:1000,
    maxConcurrent:1
});

const cfGet = async(endpoint,params={})=>{
    
    let response;

    try{
        response = await limiter.schedule(()=>cfApi.get(endpoint,{params}));
    }
    catch(err){
        if(err.response){
            const {status,comment} = err.response.data??{};
            if(status=='FAILED'){
                throw new AppError(`Codeforces API error: ${comment}`, 502, comment);
            }
            throw new AppError('Codeforces API error', 502);
        }
        logger.error({err,endpoint},'Codeforces API unreachable');
        throw new AppError('Codeforces API unavailable',503);
    }



    const { status,result,comment }=response.data;

    if(status!=='OK'){
        throw new AppError(`Codeforces API error: ${comment}`,502,result);
    }
    return result;
};

export const getUserInfo = async(handle)=>{
    const result = await cfGet('./user.info',{handles:handle});
    return result[0];
};

export const validateHandleExists = async(handle)=>{
    try{
        return await getUserInfo(handle);
    }
    catch(err){
        if(err.cfComment?.toLowerCase().includes('not found')){
            throw new AppError('Codeforces handle not found',422);
        }
        throw err;
    }
};

export const getUserStatus = async(handle, from, count)=>{
    return cfGet('/user.status',{handle,from,count});
};

export const getUserRating = async(handle)=>{
    return cfGet('/user.rating',{handle});
};

export const getRatedList = async()=>{
    return cfGet('/user.ratedList',{activeOnly:false});
};

export const getContestStandings = async(contestId)=>{
    return cfGet('/contest.standings',{contestId});
};

export const getContestList = async()=>{
    return cfGet('/contest.list',{gym:false});
};

export const getProblemsetProblems = async()=>{
    return cfGet('/problemset.problems',{});
};