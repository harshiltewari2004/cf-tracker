import { Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { onboardingService } from "@/api/onboardingService";
import { useAuthStore } from "@/stores/authStore";
import { useIngestStore } from "@/stores/ingestStore";
import {
  CF_HANDLE_MIN_LENGTH,
  CF_HANDLE_MAX_LENGTH,
  CF_HANDLE_REGEX,
} from "@/lib/constants";

const handleSchema = z.object({
  handle: z
    .string()
    .min(CF_HANDLE_MIN_LENGTH, `At least ${CF_HANDLE_MIN_LENGTH} characters`)
    .max(CF_HANDLE_MAX_LENGTH, `At most ${CF_HANDLE_MAX_LENGTH} characters`)
    .regex(CF_HANDLE_REGEX, "Letters, numbers, and underscores only"),
});

type HandleForm = z.infer<typeof handleSchema>;

const HandleEntryPage = () => {
  const onboardingCompleted = useAuthStore((s) => s.user?.onboardingCompleted);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HandleForm>({ resolver: zodResolver(handleSchema) });

  // Step 1 → step 2, reactively. The Q1 store flip triggers this eject.
  if (onboardingCompleted)
    return <Navigate to="/onboarding/ingesting" replace />;

  const onSubmit = async ({ handle }: HandleForm) => {
    try {
      await onboardingService.submitHandle(handle);
      // 200 = server already flipped onboardingCompleted (Phase 2: flip-after-
      // enqueue). Mirror it optimistically + arm the status poll.
      const user = useAuthStore.getState().user;
      if (user)
        useAuthStore.getState().setUser({ ...user, onboardingCompleted: true });
      useIngestStore.getState().setIngestActive(true);
    } catch {
      setError("root", {
        message: "Could not link that handle. Check it and try again.",
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto flex max-w-sm flex-col gap-4"
    >
      <label className="text-sm font-medium">Codeforces handle</label>
      <input
        {...register("handle")}
        placeholder="e.g. tourist"
        className="rounded border px-3 py-2"
      />
      {errors.handle && (
        <p className="text-sm text-red-600">{errors.handle.message}</p>
      )}
      {errors.root && (
        <p className="text-sm text-red-600">{errors.root.message}</p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-slate-900 py-2 text-white disabled:opacity-50"
      >
        {isSubmitting ? "Linking…" : "Continue"}
      </button>
    </form>
  );
};
export default HandleEntryPage;
