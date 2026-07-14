import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useUpdateHandle } from '@/hooks/useUser';
import {
  CF_HANDLE_MIN_LENGTH, CF_HANDLE_MAX_LENGTH, CF_HANDLE_REGEX,
} from '@/lib/constants';
import { isAxiosError } from 'axios';

const handleChangeSchema = z.object({
  handle: z
    .string()
    .min(CF_HANDLE_MIN_LENGTH)
    .max(CF_HANDLE_MAX_LENGTH)
    .regex(CF_HANDLE_REGEX, 'Only letters, digits, and underscore'),
});

type HandleChangeValues = z.infer<typeof handleChangeSchema>;

export const HandleChangeForm = () => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const updateHandle = useUpdateHandle();

  const {
    register, handleSubmit, getValues,
    formState: { errors },
  } = useForm<HandleChangeValues>({ resolver: zodResolver(handleChangeSchema) });

  
  const handleValidSubmit = () => setConfirmOpen(true);

  const handleConfirm = () => {
    updateHandle.mutate(getValues('handle'), {
      onSettled: () => setConfirmOpen(false),
    });
  };
  const getServerErrorMessage = (error: unknown): string | null => {
  if (!error) return null;
  if (isAxiosError(error) && error.response?.data?.message) {
    return error.response.data.message;
  }
  return 'Something went wrong. Please try again.';
};

  const serverError = getServerErrorMessage(updateHandle.error);

  console.log('mutation error:', updateHandle.error, '→ serverError:', serverError);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Codeforces handle</h2>
      <form onSubmit={handleSubmit(handleValidSubmit)} className="flex gap-2">
        <Input placeholder="New CF handle" {...register('handle')} />
        <Button type="submit">Change</Button>
      </form>
      {errors.handle && <p className="text-red-600 text-sm">{errors.handle.message}</p>}
      {serverError && <p className="text-red-600 text-sm">{serverError}</p>}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change handle and rebuild all data?</DialogTitle>
            <DialogDescription>
              Changing your handle deletes all analytics derived from the current
              handle and re-imports everything from Codeforces. This takes a few
              minutes; you can keep using the app while it runs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={updateHandle.isPending}>
              {updateHandle.isPending ? 'Validating…' : 'Change handle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};