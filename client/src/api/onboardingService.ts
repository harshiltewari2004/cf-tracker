import { apiClient } from "./client";

import type { IngestStatusValue } from "@/types/models";

interface SubmitHandleResponse {
  ingestStatus: IngestStatusValue;
}

export const onboardingService = {
  submitHandle: async (handle: string) => {
    const res = await apiClient.post<{
      success: boolean;
      data: SubmitHandleResponse;
    }>("/api/onboarding/codeforces", { handle });
    return res.data.data;
  },
};
