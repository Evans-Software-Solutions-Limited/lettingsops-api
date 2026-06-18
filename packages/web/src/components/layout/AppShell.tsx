import { NavLink, Outlet, useLocation } from "react-router";
import {
  IconLayoutDashboard,
  IconUsers,
  IconTools,
  IconSettings,
  IconChevronRight,
} from "@tabler/icons-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: IconLayoutDashboard, end: true },
  { to: "/leads", label: "Leads", icon: IconUsers, end: false },
  { to: "/maintenance", label: "Maintenance", icon: IconTools, end: false },
  { to: "/settings", label: "Settings", icon: IconSettings, end: false },
];

function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg) => {
    const label = seg.charAt(0).toUpperCase() + seg.slice(1);
    return label;
  });

  return (
    <div className="flex items-center gap-1.5 text-sm">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <IconChevronRight
              size={14}
              className="text-muted-foreground/50"
              stroke={1.5}
            />
          )}
          <span
            className={
              i === crumbs.length - 1
                ? "text-text font-medium"
                : "text-muted-foreground"
            }
          >
            {crumb}
          </span>
        </span>
      ))}
    </div>
  );
}

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
        <nav className="flex-1 py-3 px-2.5 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-accent/10 text-accent font-medium shadow-[inset_0_0_0_1px_rgba(59,130,246,0.15)]"
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
        <div className="border-t border-border p-3.5">
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center text-accent text-xs font-semibold ring-1 ring-accent/20">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate leading-tight">
                John Doe
              </p>
              <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                Agent
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-surface shrink-0">
          <Breadcrumbs />
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-success pulse-dot" />
              Connected
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
