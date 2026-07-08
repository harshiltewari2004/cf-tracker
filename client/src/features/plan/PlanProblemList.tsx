import { ProblemCard } from '@/components/shared/ProblemCard';

import type { PlanProblem } from '@/types/models';

interface PlanProblemListProps {
  problems: PlanProblem[];
  onSolve: (planProblemId: string) => void;
  onReplace: (planProblem: PlanProblem) => void;
  solvingId?: string;
}

export const PlanProblemList = ({ problems, onSolve, onReplace, solvingId }: PlanProblemListProps) => (
  <div className="space-y-3">
    {problems.map((p) => (
      <ProblemCard
        key={p._id}
        problem={p.problem}
        status={p.status}
        onSolve={() => onSolve(p._id)}
        onReplace={() => onReplace(p)}
        isSolving={solvingId === p._id}
      />
    ))}
  </div>
);