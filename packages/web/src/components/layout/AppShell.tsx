import { NavLink, Outlet } from "react-router";
import {
  IconLayoutDashboard,
  IconUsers,
  IconTools,
  IconSettings,
} from "@tabler/icons-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: IconLayoutDashboard, end: true },
  { to: "/leads", label: "Leads", icon: IconUsers, end: false },
  { to: "/maintenance", label: "Maintenance", icon: IconTools, end: false },
  { to: "/settings", label: "Settings", icon: IconSettings, end: false },
];

export function AppShell() {
  return (
    <div className="flex h-screen bg-surface text-text overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col border-r border-border bg-surface-elevated shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-border">
          <span className="text-lg font-semibold tracking-tight bg-gradient-to-r from-accent to-blue-400 bg-clip-text text-transparent">
            LettingsOps
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-muted-foreground hover:bg-surface-raised hover:text-text",
                ].join(" ")
              }
            >
              <Icon size={18} stroke={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User profile at bottom */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-semibold">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate">John Doe</p>
              <p className="text-xs text-muted-foreground truncate">Agent</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center px-6 border-b border-border bg-surface-raised shrink-0">
          <span className="text-sm text-muted-foreground">
            Lettings Management Platform
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
