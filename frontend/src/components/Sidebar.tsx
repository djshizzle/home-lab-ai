import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Ticket,
  Monitor,
  Activity,
  Zap,
} from "lucide-react";
import clsx from "clsx";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tickets", label: "Tickets", icon: Ticket },
  { to: "/devices", label: "Devices", icon: Monitor },
  { to: "/agents", label: "Agent Runs", icon: Zap },
  { to: "/health", label: "Health", icon: Activity },
];

export function Sidebar() {
  return (
    <aside className="w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-webex-blue flex items-center justify-center">
            <Zap className="w-4 h-4 text-gray-950" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-100">AVops</p>
            <p className="text-xs text-gray-400">Webex Support AI</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-webex-blue/15 text-webex-blue font-medium"
                  : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-600">7-Agent Architecture</p>
        <p className="text-xs text-gray-700">claude-opus-4-6 · AWS</p>
      </div>
    </aside>
  );
}
