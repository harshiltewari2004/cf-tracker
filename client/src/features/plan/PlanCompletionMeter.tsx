import type { PlanProblem } from '@/types/models';

interface PlanCompletionMeterProps {
  problems: PlanProblem[];
}

export const PlanCompletionMeter = ({ problems }: PlanCompletionMeterProps) => {
  const solvedCount = problems.filter((p) => p.status === 'solved').length;

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary transition-all"
          style={{ width: `${(solvedCount / problems.length) * 100}%` }}
        />
      </div>
      <span className="text-sm text-muted-foreground">
        {solvedCount}/{problems.length} solved
      </span>
    </div>
  );
};