
import { ExternalLink } from 'lucide-react';

import type { ContestProblemDetail } from '@/types/models';


const formatTime = (minutes: number | null | undefined) =>
  minutes != null ? `${minutes}m` : '—';


const STATUS_STYLE: Record<ContestProblemDetail['status'], { label: string; className: string }> = {
  solved: { label: 'Solved', className: 'bg-green-50 text-green-700 border-green-200' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700 border-red-200' },
  unattempted: { label: 'Unattempted', className: 'bg-slate-100 text-slate-500 border-transparent' },
};

interface ContestProblemMatrixProps {
  problems: ContestProblemDetail[];
}

export const ContestProblemMatrix = ({ problems }: ContestProblemMatrixProps) => {
  return (
    <div className="space-y-3">
      {problems.map((row) => {
        const style = STATUS_STYLE[row.status];

        return (
          <div
            key={row.problemIndex}
            className="flex items-center gap-4 rounded-lg border bg-white p-4"
          >
            {/* index chip — RAW problemIndex (D-P11-3): C1 stays C1 */}
            <span className="w-10 shrink-0 text-center font-mono text-sm font-semibold">
              {row.problemIndex}
            </span>

            {/* name → external link to CF (the upsolve affordance) */}
            <a
              href={row.problem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 flex-1 items-center gap-1.5 truncate hover:underline"
            >
              <span className="truncate">{row.problem.name}</span>
              <ExternalLink className="size-3.5 shrink-0 text-slate-400" />
            </a>

            {/* rating */}
            <span className="shrink-0 text-sm text-slate-500">{row.problem.rating}</span>

            {/* status — keyed off the enum, three-way */}
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.className}`}
            >
              {style.label}
            </span>

            {/* time — null-guard via formatTime (— for failed/unattempted) */}
            <span className="w-12 shrink-0 text-right text-sm tabular-nums">
              {formatTime(row.firstACTime)}
            </span>

            {/* failCount — detail on top of an already-decided state, only when > 0 */}
            {row.failCount > 0 && (
              <span className="shrink-0 text-xs text-red-600">{row.failCount} WA</span>
            )}
          </div>
        );
      })}
    </div>
  );
};