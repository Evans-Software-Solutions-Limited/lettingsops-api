import { NavLink, Outlet } from "react-router";
import { IconLayoutDashboard, IconUsers } from "@tabler/icons-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: IconLayoutDashboard, end: true },
  { to: "/leads", label: "Leads", icon: IconUsers, end: false },
];

export function AppShell() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col border-r border-border bg-card shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-border">
          <span
            className="text-lg font-semibold tracking-tight"
            style={{ color: "var(--brand-primary)" }}
          >
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
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                ].join(" ")
              }
            >
              <Icon size={18} stroke={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center px-6 border-b border-border bg-card shrink-0">
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
