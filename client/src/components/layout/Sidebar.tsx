import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/plan", label: "Plan" },
  { to: "/weakness", label: "Weakness" },
  { to: "/contests", label: "Contests" },
  { to: "/settings", label: "Settings" },
];

export const Sidebar = () => (
  <aside className="w-56 border-r border-slate-200 p-4">
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "rounded-md px-3 py-2 text-sm",
              isActive
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100",
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  </aside>
);
