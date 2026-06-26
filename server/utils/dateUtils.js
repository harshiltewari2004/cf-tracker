import { differenceInDays } from 'date-fns';

export const daysBetween = (a, b) => Math.abs(differenceInDays(a, b));

export const getDateOnly = (date) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};