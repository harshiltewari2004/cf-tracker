import { NavLink } from 'react-router-dom';

import { NAV_ITEMS } from '@/lib/constants';

export const BottomNav = () => {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-white md:hidden">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              isActive ? 'font-medium text-slate-900' : 'text-slate-500'
            }`
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
};