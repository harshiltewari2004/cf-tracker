import { useEffect } from "react";

import { useQuery } from "@tanstack/react-query";

import { ingestService } from "@/api/ingestService";
import { useIngestStore } from "@/stores/ingestStore";
import { INGEST_POLL_INTERVAL_MS } from "@/lib/constants";

export const useIngestStatus = () => {
  const isIngestActive = useIngestStore((s) => s.isIngestActive);

  const query = useQuery({
    queryKey: ["ingest", "status"],
    queryFn: ingestService.getStatus,
    enabled: isIngestActive,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === "complete" || status === "failed") return false;
      return INGEST_POLL_INTERVAL_MS;
    },
  });

  const status = query.data?.status;
  useEffect(() => {
    if (status === "complete" || status === "failed") {
      useIngestStore.getState().setIngestActive(false);
    }
  }, [status]);

  return query;
};
