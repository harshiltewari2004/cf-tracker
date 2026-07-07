import { generatePlan } from '../engines/DailyPlanEngine.js';

export const getTodaysPlan = async (userId) => {

  const plan = await generatePlan(userId, new Date());

  await plan.populate('problems.problem', 'name rating tags url cfContestId cfIndex');

  return plan;
};