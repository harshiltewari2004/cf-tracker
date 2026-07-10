import type { ReliabilityContestEntry } from '@/types/models';
import type { ContestResult } from '@/types/models';

interface ContestRowProps {
  contest: ContestResult;
  ab: ReliabilityContestEntry | undefined;
}

export const ContestRow = ({ contest, ab }: ContestRowProps) => (
  <li className="flex items-center justify-between gap-4 py-3">
    <div className="min-w-0">
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
);