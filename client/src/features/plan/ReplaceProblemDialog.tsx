import { isAxiosError } from 'axios';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { PlanProblem } from '@/types/models';

interface ReplaceProblemDialogProps {
  target: PlanProblem | null;
  isReplacing: boolean;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
}

const getReplaceErrorMessage = (error: unknown) => {
  if (isAxiosError(error) && error.response?.status === 422) {
    // Observed shape: { success: false, message: "No replacement problem available" }
    return error.response.data.message as string;
  }
  if (error) return 'Something went wrong. Please try again.';
  return null;
};

export const ReplaceProblemDialog = ({
  target,
  isReplacing,
  error,
  onConfirm,
  onClose,
}: ReplaceProblemDialogProps) => {
  const errorMessage = getReplaceErrorMessage(error);

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace this problem?</DialogTitle>
          <DialogDescription>
            {target?.problem.name} will be swapped for another problem from your stretch zone.
            This won't count as a fail.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isReplacing}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isReplacing}>
            {isReplacing ? 'Replacing…' : 'Replace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};