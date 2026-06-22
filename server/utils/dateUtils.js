import {differenceInDays} from 'date-fns';

export const daysBetween = (a,b)=>Math.abs(differenceInDays(a,b));