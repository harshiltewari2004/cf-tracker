import { BUCKET_RANGES, STRETCH_ZONE_SPAN } from '../config/constants.js';

export const ratingToBucket = (rating) => {
  if (rating == null) return null; 
  const bucket = BUCKET_RANGES.find((b) => rating >= b.low && rating < b.high);
  return bucket ? bucket.label : null; 
};

export const getTopicBucketRows =(problem)=>{
  if(problem?.rating==null) return [];

  const bucket = ratingToBucket(problem.rating);
  if(!bucket)return[];

  const tags = problem.tags??[];
  return tags.map((topic)=>({topic,bucket}));
};

export const getBuckets = () => BUCKET_RANGES.map((b) => b.label);

export const isInStretchZone = (rating, userRating) =>
  rating != null && rating >= userRating && rating <= userRating + STRETCH_ZONE_SPAN;