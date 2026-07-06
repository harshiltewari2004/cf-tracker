export interface User {
  id: string;
  name: string;
  email: string;
  onboardingCompleted: boolean;
  onBoardingStep: number;
  coldStartComplete: boolean;
}
export type IngestStatusValue =
  "not_started" | "pending" | "processing" | "complete" | "failed";
