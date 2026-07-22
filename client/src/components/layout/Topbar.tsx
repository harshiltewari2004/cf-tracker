import { useAuthStore } from "@/stores/authStore";
import { IngestStatusBanner } from "@/components/shared/IngestStatusBanner";

const getInitials = (name?: string) =>
  (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const Topbar = () => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

   return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <IngestStatusBanner />
      <div className="flex items-center gap-3">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
          {getInitials(user?.name)}
        </div>
        <span className="text-sm font-semibold text-slate-900">{user?.name}</span>
        <span className="h-4 w-px bg-slate-200" />
        <button
          onClick={() => void logout()}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          Logout
        </button>
      </div>
    </header>
  );
};
