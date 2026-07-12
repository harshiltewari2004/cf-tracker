export interface User {
  id: string;
  name: string;
  email: string;
  onboardingCompleted: boolean;
  onBoardingStep: number;
  coldStartComplete: boolean;
}

export interface ReliabilityContestEntry {
  contestId: number;
  solvedA: boolean;
  solvedB: boolean;
  timeA: number | null;
  timeB: number | null;
  aReliable: boolean;
  bReliable: boolean;
}

export interface ReliabilityScore {
  aReliableCount: number;
  bReliableCount: number;
  last6Contests: ReliabilityContestEntry[];
  reliabilityProgress: number;
  totalReal: number;
  lastCalculated: string;
}

export interface ContestResult {
  cfContestId: number;
  contestName: string;
  isDiv2: boolean;
  rank: number;
  oldRating: number;
  newRating: number;
  ratingChange: number;
  participatedAt: string;
}

export interface TopicBucketScore {
  topic: string;          
  bucket: string;         
  solves: number;
  targetCount: number;
  baseGap: number;
  contestFails: number;
  contestOpportunities: number;
  penalty: number;
  finalGap: number;
  lastCalculated: string;
}

export type IngestStatusValue =
  "not_started" | "pending" | "processing" | "complete" | "failed";


export type PlanType = 'cold_start' | 'gap_driven';
export type PlanProblemType = 'gap' | 'upsolve';
export type PlanProblemStatus = 'pending' | 'solved' | 'failed' | 'skipped';

export interface ProblemSummary {
  _id: string;
  cfContestId: number;
  cfIndex: string;       
  name: string;
  rating: number;
  tags: string[];         
  url: string;
}

export interface PlanProblem {
  _id: string;          
  problem: ProblemSummary;
  type: PlanProblemType;
  status: PlanProblemStatus;
  solvedAt?: string;
}

export interface DailyPlan {
  _id: string;
  date: string;           
  planType: PlanType;
  problems: PlanProblem[];
  completed: boolean;
}  
export interface BenchmarkMeta {
  _id: string;
  filters: {
    country: string;
    minRating: number;
    maxRating: number;
    minContests: number;
    minSolves: number;
    lastContestWithinDays: number;
  };
  N: number;
  fallbackUsed: string | null;
  lastRefreshed: string; // ISO string over the wire, not Date
  version: number;
}
export interface ContestProblemDetail {
  _id: string;
  problemIndex: string;          
  problem: {
    _id: string;
    name: string;
    rating: number;
    url: string;
  };                            
  status: 'solved' | 'failed' | 'unattempted';
  firstACTime: number | null;   
  failCount: number;
  isDiv2A: boolean;              
  isDiv2B: boolean;
}

export interface ContestDetail {
  _id: string;
  cfContestId: number;
  contestName: string;
  isDiv2: boolean;
  rank: number;
  oldRating: number;
  newRating: number;
  ratingChange: number;
  participatedAt: string;
  problems: ContestProblemDetail[];
}