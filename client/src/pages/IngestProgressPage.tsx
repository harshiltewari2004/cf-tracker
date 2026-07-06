import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useIngestStatus } from '@/hooks/useIngestStatus';
import { useIngestStore } from '@/stores/ingestStore';
import { LoadingState } from '@/components/shared/LoadingState';

 const IngestProgressPage = () => {
  const { data , isError} = useIngestStatus();
  const [proceed, setProceed] = useState(false);

  // Refresh-safety: re-arm the poll if the user reloaded straight onto this route.
  useEffect(() => {
    useIngestStore.getState().setIngestActive(true);
  }, []);

  if (proceed) return <Navigate to="/dashboard" replace />;
  if (isError) {
  return (
    <p className="text-center text-red-600">
      Couldn't check ingest progress. Refresh to retry.
    </p>
  );
}
  if (!data) return <LoadingState />;

  if (data.status === 'complete') return <Navigate to="/dashboard" replace />;
  if (data.status === 'not_started') return <Navigate to="/onboarding/handle" replace />;

  if (data.status === 'failed') {
    return <p className="text-center text-red-600">Ingest failed. Please retry from Settings.</p>;
  }

  // pending | processing
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
      <p className="font-medium">Setting up your account…</p>
      <p className="text-sm text-slate-500">{data.submissionsIngested} submissions imported</p>
      {/* Don't block the user (05 §3.7): partial dashboard + banner keeps progress visible. */}
      <button onClick={() => setProceed(true)} className="text-sm text-slate-600 underline">
        Continue to dashboard
      </button>
    </div>
  );
};
export default IngestProgressPage;