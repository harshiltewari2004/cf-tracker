import { SuccessMetricBanner } from '@/features/contests/SuccessMetricBanner';
import { ReliabilityBreakdown } from '@/features/contests/ReliabilityBreakdown';
const ContestsPage = () => {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Contests</h1>
      <SuccessMetricBanner />
    
      <ReliabilityBreakdown />
    </div>
  );
};

export default ContestsPage;