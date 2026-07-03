import { useAuthStore } from '@/stores/authStore';

export const Topbar = () => {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 px-6">
      {/* <IngestStatusBanner /> slot — Piece 6 */}
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-600">{user?.name}</span>
        <button className="text-sm text-slate-500 hover:text-slate-900">
          Logout
        </button>
      </div>
    </header>
  );
};