import CFProfile from "../models/CFProfile.js";
import Problem from "../models/Problem.js";
import TopicBucketScore from "../models/TopicBucketScore.js";
import {
  STRETCH_ZONE_SPAN,
  COLD_START_TAG_SMOOTHING,
} from "../config/constants.js";
import { getStretchZoneBuckets } from "../utils/bucketUtils.js";
import { AppError } from "../utils/errors.js";
import Submission from '../models/Submission.js';
import Problem from "../models/Problem.js";
import { DAILY_PLAN_SIZE,STRETCH_ZONE_SPAN } from "../config/constants.js";
import { PLAN_TYPE } from "../config/constants.js";
import UpSolveQueue from '../models/UpsolveQueue.js';
import {getDateOnly} from '../utils/dateUtils.js';
import DailyPlan from '../models/DailyPlan.js';
import User from '../models/User.js';


export const getColdStartPlan = async (userId) => {
  const profile = await CFProfile.findOne({ user: userId })
    .select("currentRating")
    .lean();

  if (!profile || profile.currentRating == null) {
    throw new AppError("Cannot build cold-start plan:no currentRating", 422);
  }
  const low = profile.currentRating;
  const high = profile.currentRating + STRETCH_ZONE_SPAN;
  const stretchBuckets = getStretchZoneBuckets(low, high);

  const rankedTags = await rankWeakTags(userId, stretchBuckets);

  return selectColdStartProblems(userId, rankedTags, {
    low,
    high,
    stretchBuckets,
  });
};

const rankWeakTags = async (userId, stretchBuckets) => {
  const catalogFreq = await Problem.aggregate([
    { $match: { ratingBucket: { $in: stretchBuckets } } },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
  ]);
  const scoreRows = await TopicBucketScore.find({
    user: userId,
    bucket: { $in: stretchBuckets },
  })
    .select("topic solves")
    .lean();

  const solvesByTag = new Map();
  for (const row of scoreRows) {
    solvesByTag.set(row.topic, (solvesByTag.get(row.topic) ?? 0) + row.solves);
  }
  return catalogFreq
    .map(({ _id: tag, count }) => {
      const solves = solvesByTag.get(tag) ?? 0;
      return { tag, weakness: count / (solves + COLD_START_TAG_SMOOTHING) };
    })
    .sort((a, b) => b.weakness - a.weakness)
    .map((entry) => entry.tag);
};

const selectColdStartProblems = async (userId, rankedTags, {low,high}) => {
  const seenDocs = await Submission.find({user:userId})
    .select('problem')
    .lean();
  
  const seendIds = new Set(seenDocs.map((s)=> String(s.problem)));

  const selected=[];
  const selectedIds = new Set();
  const tagPools = new Map();

  const loadPool = async(tag)=>{
    if(tagPools.has(tag))return tagPools.get(tag);

    const problems = await Problem.find({
      tags:tag,
      rating:{$gte:low,$lte:high},
    })
    .select('_id rating tags name cfContestId cfIndex url')
    .sort({rating:1})
    .lean();

    const pool = problems.filter(
      (p)=>!seendIds.has(String(p._id))&&!selectedIds.has(String(p._id))
    );
    tagPools.set(tag,pool);
    return pool;
  };

  const take = (pool)=>{
    const problem = pool.shift();
    selected.push(problem);
    selectedIds.add(String(problem._id));
  };

  for(const tag of rankedTags){
    if(selected.length===DAILY_PLAN_SIZE)break;
    const pool = await loadPool(tag);

    while(pool.length&&selectedIds.has(String(pool[0]._id)))pool.shift();
    if(pool.length==0)continue;
    take(pool);
  }
  if(selected.length<DAILY_PLAN_SIZE){
    for(const tag of rankedTags){
      let pool = tagPools.get(tag)??[];
      while(pool.length&&selected.length<DAILY_PLAN_SIZE){
        while(pool.length&&selectedIds.has(String(pool[0]._id)))pool.shift();
        if(pool.length==0)break;
        take(pool);
      }
      if(selected.length===DAILY_PLAN_SIZE)break;
    }
  }
  return selected.map((problem)=>({
    problem:problem._id,
    type:'gap',
    status:'pending'
  }));
};

const selectGapProblems = async(userId,{low,high},count,seendIds)=>{
  const inZoneBuckets = getStretchZoneBuckets(low,high);

  const rows = await TopicBucketScore.find({user:userId})
  .select('topic bucket finalGap')
  .sort({finalGap:-1})
  .lean();

  const selected=[];
  const selectedIds=new Set();

  for(const row of rows){
    if(selected.length===count)break;

    const candidates = await Problem.find({
      tags:row.topic,
      ratingBucket:{$in:inZoneBuckets},
      rating:{$gte:low,$lte:high},
    })
    .select('_id rating tags name cfContestId cfIndex url')
    .sort({rating:1})
    .lean();

    const pick = candidates.find(
      (p)=>!seendIds.has(String(p._id))&&!selectedIds.has(String(p._id))
    );
    if(!pick)continue;

    selected.push({problem:pick._id,type:'gap',status:'pending'});

    selectedIds.add(String(pick._id));
  }
  return selected;
};

const selectUpsolveProblems = async(userId,date)=>{
  const date = getDateOnly(date);

  const entry = await UpSolveQueue.findOne({
    user:userId,
    status:'pending',
    scheduledFor:{$lte:today},

  })
  .sort({addedAt:1})
  .select('problem')
  .lean();
  
  if(!entry) return[];

  return [{problem:entry.problem,type:'upsolve',status:'pending'}];
};

const gapDrivenPlan = async(userId,date)=>{
  const profile = await CFProfile.findOne({user:userId})
  .select('currentRating')
  .lean();

  if(!profile||profile.currentRating==null){
    throw new AppError('Cannot build gap-driven plan:no currentRating',422);
  }
  const zone ={
    low:profile.currentRating,
    high:profile.currentRating+STRETCH_ZONE_SPAN
  };

  const seenDocs = await Submission.find({user:userId}).select('problem').lean();
  const seenIds  = await new Set(seenDocs.map((s)=>String(s.problem)));

  const upSolveProblems = await selectUpsolveProblems(userId,date);
  const gapCount = DAILY_PLAN_SIZE-upSolveProblems.length;
  const gapProblems = await selectGapProblems(userId,zone,gapCount,seenIds);

  return[...gapProblems,...upSolveProblems];
};

export const generatePlan = async(userId,date)=>{
  const planDate = getDateOnly(date);
  const user = await User.findById(userId).select('coldStartComplete').lean();

  if(!user)throw new AppError('User not found',404);

  const isColdStart = !user.coldStartComplete;
  const problems = isColdStart
  ?await getColdStartPlan(userId)
  :await getColdStartPlan(userId,planDate);

  const planType = isColdStart?PLAN_TYPE.COLD_START:PLAN_TYPE.GAP_DRIVEN;

  const plan = await DailyPlan.findOneAndUpdate(
    {user:userId,date:planDate},
    {$setOnInsert:{user:userId,date:planDate,planType,problems,completed:false}},
    {upsert:true,new:true,setDefaultsOnInsert:true}
  );
  return plan;
};