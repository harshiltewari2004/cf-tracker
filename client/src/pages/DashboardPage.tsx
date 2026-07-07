import { DailyPlanWidget } from '@/features/dashboard/DailyPlanWidget';
import { ReliabilitySummary } from '@/features/dashboard/ReliabilitySummary';
import { RecentContestsCard } from '@/features/dashboard/RecentContestsCard';
import { TopGapsCard } from '@/features/dashboard/TopGapsCard';

const DashboardPage = () => (
  <div className="grid gap-4 md:grid-cols-2">
    <DailyPlanWidget />
    <ReliabilitySummary />
    <RecentContestsCard />
    <TopGapsCard />
  </div>
);

export default DashboardPage;