import ContestResult from '../models/ContestResult.js';
import ContestProblemResult from '../models/ContestProblemResult.js';
import ReliabilityScore from '../models/ReliabilityScore.js';
import {
    RELIABLE_A_MINUTES,
    RELIABLE_B_MINUTES,
    RELIABILITY_WINDOW,
    RELIABILITY_TARGET,
} from '../config/constants.js';


export const computeReliabilityProgress =(aReliableCount,bReliableCount)=>
    Math.min(Math.min(aReliableCount,bReliableCount)/RELIABILITY_TARGET,1);


export const refresh = async(userId)=>{
    const contests = await ContestResult.find({user:userId,isDiv2:true})
        .sort({participatedAt:-1})
        .limit(RELIABILITY_WINDOW)
        .select('cfContestId participatedAt')
        .lean();

    const contestIds = contests.map((c)=>c.cfContestId);

    const problemRows = await ContestProblemResult.find({
        user:userId,
        cfContestId:{$in:contestIds},
        $or:[{isDiv2A:true},{isDiv2B:true}],
    })
    .select('cfContestId isDiv2A isDiv2B status firstACTime')
    .lean();

    const aByContest = new Map();
    const bByContest = new Map();

    for(const row of problemRows){
        if(row.isDiv2A)aByContest.set(row.cfContestId,row);
        if(row.isDiv2B)bByContest.set(row.cfContestId,row);
    }

    const last6Contests=[];
    let aReliableCount=0;
    let bReliableCount=0;

    for(const contest of contests){
        const aRow = aByContest.get(contest.cfContestId);
        const bRow = bByContest.get(contest.cfContestId);

        const solvedA = aRow?.status==='solved';
        const solvedB = bRow?.status==='solved';
        const timeA = solvedA?aRow.firstACTime:null;
        const timeB= solvedB?bRow.firstACTime:null;

        const aReliable = solvedA && timeA<RELIABLE_A_MINUTES;
        const bReliable = solvedB && timeB<RELIABLE_B_MINUTES;

        if(aReliable)aReliableCount+=1;
        if(bReliable)bReliableCount+=1;

        last6Contests.push({
            contestId:contest.cfContestId,
            solvedA,
            solvedB,
            timeA,
            timeB,
            aReliable,
            bReliable,
        });
    }
    const reliabilityProgress = computeReliabilityProgress(aReliableCount,bReliableCount);

    const score = await ReliabilityScore.findOneAndUpdate(
        {user:userId},
        {
            $set:{
                last6Contests,
                aReliableCount,
                bReliableCount,
                totalReal:contests.length,
                reliabilityProgress,
                lastCalculated:new Date(),
            },
        },
        {upsert:true,returnDocument:'after',setDefaultsOnInsert:true}
    );
    return score;
}

export const getReliability = async(userId)=>{
    return ReliabilityScore.findOne({user:userId}).lean();
};