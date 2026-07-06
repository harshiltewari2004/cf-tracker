import { useIngestStatus } from "@/hooks/useIngestStatus";
import { useIngestStore } from "@/stores/ingestStore";

export const IngestStatusBanner = () => {
  const isIngestActive = useIngestStore((s) => s.isIngestActive);
  const { data } = useIngestStatus();

  // Self-clears: useIngestStatus flips isIngestActive false on terminal status.
  if (!isIngestActive || !data) return null;
  if (data.status !== "pending" && data.status !== "processing") return null;

  return (
    <div className="text-sm text-amber-700">
      Importing your Codeforces history… {data.submissionsIngested} so far
    </div>
  );
};
