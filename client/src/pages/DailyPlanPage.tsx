import { useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { PlanCompletionMeter } from '@/features/plan/PlanCompletionMeter';
import { PlanProblemList } from '@/features/plan/PlanProblemList';
import { ReplaceProblemDialog } from '@/features/plan/ReplaceProblemDialog';
import { useDailyPlan, useMarkSolved, useReplaceProblem } from '@/hooks/useDailyPlan';

import type { PlanProblem } from '@/types/models';

const DailyPlanPage = () => {
  const { data: plan, isLoading, isError } = useDailyPlan();
  const markSolved = useMarkSolved();
  const replaceProblem = useReplaceProblem();
  const [replaceTarget, setReplaceTarget] = useState<PlanProblem | null>(null);

  if (isLoading) return <LoadingState />;
  if (isError) return <EmptyState title="Couldn't load today's plan" description="Please try again." />;
  if (!plan || plan.problems.length === 0)
    return <EmptyState title="No plan for today" description="Check back after your next sync." />;

  const handleConfirmReplace = () => {
    if (!replaceTarget) return;
    replaceProblem.mutate(replaceTarget._id, {
      onSuccess: () => setReplaceTarget(null),
    });
  };

  const handleCloseDialog = () => {
    replaceProblem.reset(); // clear a stale 422 so reopening starts clean
    setReplaceTarget(null);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Today's Plan</h1>
      </div>

      <PlanCompletionMeter problems={plan.problems} />

      <PlanProblemList
        problems={plan.problems}
        onSolve={(planProblemId) => markSolved.mutate(planProblemId)}
        onReplace={(planProblem) => setReplaceTarget(planProblem)}
        solvingId={markSolved.isPending ? markSolved.variables : undefined}
      />

      <ReplaceProblemDialog
        target={replaceTarget}
        isReplacing={replaceProblem.isPending}
        error={replaceProblem.error}
        onConfirm={handleConfirmReplace}
        onClose={handleCloseDialog}
      />
    </div>
  );
};

export default DailyPlanPage;