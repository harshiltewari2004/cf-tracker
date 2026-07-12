import type { ReliabilityContestEntry } from '@/types/models';
import type { ContestResult } from '@/types/models';
import { useNavigate } from 'react-router-dom';
interface ContestRowProps {
  contest: ContestResult;
  ab: ReliabilityContestEntry | undefined;
}

export const ContestRow = ({ contest, ab }: ContestRowProps) => {
  const navigate = useNavigate();
  return (
  <li
  onClick={() => navigate(`/contests/${contest.cfContestId}`)}
  className="flex cursor-pointer items-center justify-between gap-4 py-3 hover:bg-slate-50"
>    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{contest.contestName}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {new Date(contest.participatedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
        {' · '}rank {contest.rank}
      </p>
    </div>
    <div className="flex shrink-0 items-center gap-3 text-sm">
      <span className="text-xs text-slate-500">
        A {ab ? (ab.solvedA ? '✓' : '✗') : '–'} · B {ab ? (ab.solvedB ? '✓' : '✗') : '–'}
      </span>
      <span className={contest.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'}>
        {contest.ratingChange >= 0 ? '+' : ''}
        {contest.ratingChange}
      </span>
    </div>
  </li>
)};