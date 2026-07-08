import { TopicBadge } from './TopicBadge';

import type { PlanProblemStatus, ProblemSummary } from '@/types/models';

interface ProblemCardProps {
  problem: ProblemSummary;
  status?: PlanProblemStatus;
  onSolve?: () => void;
  onReplace?: () => void;
  isSolving?: boolean;
}

export const ProblemCard = ({ problem, status, onSolve, onReplace, isSolving }: ProblemCardProps) => {
  const isPending = status === 'pending';

  return (
    <div className="flex items-start justify-between rounded-lg border p-4">
      <div>
        <a
          href={problem.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
        >
          {problem.name}
        </a>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="text-sm text-muted-foreground">{problem.rating}</span>
          {problem.tags.map((tag) => (
            <TopicBadge key={tag} topic={tag} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {status && <span className="text-sm text-muted-foreground">{status}</span>}
        {isPending && onSolve && (
          <button
            onClick={onSolve}
            disabled={isSolving}
            className="rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
          >
            Mark solved
          </button>
        )}
        {isPending && onReplace && (
          <button
            onClick={onReplace}
            className="rounded-md border px-3 py-1 text-sm text-muted-foreground hover:bg-accent"
          >
            Can't solve this
          </button>
        )}
      </div>
    </div>
  );
};