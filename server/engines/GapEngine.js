import { GAP_BETA, KEY_SEP } from "../config/constants.js";
import { clamp } from "../utils/mathUtils.js";
import Submission from '../models/Submission.js';
import {getTopicBucketRows} from '../utils/bucketUtils.js';
import ContestProblemResult from '../models/ContestProblemResult.js';
import BenchmarkTargetCount from '../models/BenchmarkTargetCount.js';
import TopicBucketScore from '../models/TopicBucketScore.js';
export const computeGap = ({
  solves,
  targetCount,
  contestFails,
  contestOpportunities,
}) => {
  const penalty =
    contestOpportunities <= 0
      ? 0
      : GAP_BETA * (contestFails / contestOpportunities);
const baseGap = targetCount <= 0 ? 0 : clamp(1 - solves / targetCount, 0, 1);
  const finalGap = clamp(baseGap + penalty, 0, 1);
  
  return { baseGap, penalty, finalGap };
};

const aggregateSolves = async(userId)=>{
  const submissions = await Submission.find({user:userId,verdict:'OK'})
    .populate('problem','rating tags')
    .lean();


    const distinctProblems = new Map();
    for(const submission of submissions){
      if(!submission.problem)continue;
      const key = String(submission.problem._id);
      if(!distinctProblems.has(key)){
        distinctProblems.set(key,submission.problem);
      }
    }

  const solvesByKey = new Map();

  for(const problem of distinctProblems.values()){
    for(const {topic,bucket}of getTopicBucketRows(problem)){
      const key = `${topic}|${bucket}`;
      solvesByKey.set(key,(solvesByKey.get(key)??0)+1);
    }
  }
  return solvesByKey;
};

const aggregrateContestSignal = async(userId)=>{
  const rows = await ContestProblemResult.find({user:userId})
  .populate('problem','rating tags')
  .lean();

  const failsByKey = new Map();
  const opportunitiesByKey = new Map();

  for(const row of rows){
    if(!row.isDiv2A&&!row.isDiv2B)continue;
    if(!row.problem)continue;

    const tbRows = getTopicBucketRows(row.problem);

    for(const {topic,bucket}of tbRows){
      const key = `${topic}|${bucket}`;

      opportunitiesByKey.set(key , (opportunitiesByKey.get(key)??0)+1);

      if(row.status==='failed'){
        failsByKey.set(key,(failsByKey.get(key)??0)+1);
      }
    }
  }
  return {failsByKey,opportunitiesByKey};
};

const aggregrateTargetCounts = async()=>{
  const latest = await BenchmarkTargetCount.findOne()
  .sort({cohortVersion:-1})
  .select('cohortVersion')
  .lean();

  if(!latest) return new Map();

  const rows = await BenchmarkTargetCount.find({cohortVersion:latest.cohortVersion})
  .select('topic bucket p50')
  .lean();

  const targetByKey = new Map();
  for(const row of rows){
    const key = `${row.topic}|${row.bucket}`;
    targetByKey.set(key,row.p50);
  }
  return targetByKey;
};

export const recalculate = async(userId)=>{
  const solvesByKey = await aggregateSolves(userId);
  const {failsByKey,opportunitiesByKey}=await aggregrateContestSignal(userId);
  const targetByKey = await aggregrateTargetCounts();

  const allKeys = new Set([
    ...solvesByKey.keys(),
    ...failsByKey.keys(),
    ...opportunitiesByKey.keys(),
    ...targetByKey.keys(),
  ]);

  const now = new Date();

  for(const key of allKeys){
    const [topic,bucket] = key.split(KEY_SEP);

    const solves = solvesByKey.get(key)??0;
    const targetCount = targetByKey.get(key)??0;
    const contestFails = failsByKey.get(key)??0;
    const contestOpportunities = opportunitiesByKey.get(key)??0;

    const {baseGap,penalty,finalGap}=computeGap({
      solves,
      targetCount,
      contestFails,
      contestOpportunities,
    });

    await TopicBucketScore.findOneAndUpdate(
      {user:userId,topic,bucket},
      {
        $set:{
          solves,
          targetCount,
          baseGap,
          contestFails,
          contestOpportunities,
          penalty,
          finalGap,
          lastCalculated:now,
        },
      },
      { upsert:true}
    );
  }

};