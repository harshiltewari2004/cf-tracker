import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from '@/lib/constants';


export const Sidebar = () => (
  <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
    <div className="mb-6 flex items-center gap-2.5 px-1.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-brand shadow-[0_2px_6px_hsl(var(--brand)/0.35)]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="13" width="4.5" height="8" rx="1.5" fill="#ffffff" />
          <rect x="9.75" y="8" width="4.5" height="13" rx="1.5" fill="#ffffff" />
          <rect x="16.5" y="3" width="4.5" height="18" rx="1.5" fill="#ffffff" />
        </svg>
      </div>
      <span className="text-[15px] font-bold tracking-[-0.02em]">CF Tracker</span>
    </div>
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'rounded-[9px] px-3 py-2.5 text-sm',
              isActive
                ? 'bg-brand font-semibold text-white'
                : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  </aside>
);