import { NavLink, Outlet, useLocation } from "react-router";
import {
  IconLayoutDashboard,
  IconUsers,
  IconHome,
  IconSearch,
  IconBell,
  IconLogout,
} from "@tabler/icons-react";
import { Button } from "../ui/button";

const navItems = [
  { to: "/", label: "Dashboard", icon: IconLayoutDashboard, end: true },
  { to: "/leads", label: "Leads", icon: IconUsers, end: false },
];

export function AppShell() {
  const location = useLocation();

  // Simple mock user (in production, get from context/auth)
  const user = {
    email: "user@lettingsops.com",
    initials: "UO",
  };

  const getPageTitle = () => {
    if (location.pathname === "/") return "Dashboard";
    if (location.pathname.startsWith("/leads")) return "Leads";
    if (location.pathname === "/login") return "Login";
    return "LettingsOps";
  };

  return (
    <div className="flex h-screen bg-[#12141f] text-[#e8e9f0] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-[#1a1d2e] flex flex-col border-r border-[#2a2d3e] shrink-0">
        {/* Logo Section */}
        <div className="h-16 flex items-center px-5 border-b border-[#2a2d3e]">
          <div className="flex items-center gap-2">
            <IconHome size={24} className="text-indigo-400" />
            <span className="text-lg font-bold text-[#e8e9f0]">LettingsOps</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg mx-0 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "text-[#8b8fa8] hover:bg-[#252840] hover:text-[#e8e9f0]"
                }`
              }
            >
              <Icon size={20} stroke={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User Section at Bottom */}
        <div className="border-t border-[#2a2d3e] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center">
              {user.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#8b8fa8] truncate">{user.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-[#8b8fa8] hover:text-[#e8e9f0] hover:bg-[#252840]"
              title="Sign out"
            >
              <IconLogout size={16} stroke={1.5} />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 bg-[#1a1d2e] border-b border-[#2a2d3e] px-6 flex items-center justify-between shrink-0">
          {/* Left: Page Title */}
          <h1 className="text-lg font-semibold text-[#e8e9f0]">
            {getPageTitle()}
          </h1>

          {/* Right: Icons */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-[#8b8fa8] hover:text-[#e8e9f0] hover:bg-[#252840]"
            >
              <IconSearch size={18} stroke={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-[#8b8fa8] hover:text-[#e8e9f0] hover:bg-[#252840]"
            >
              <IconBell size={18} stroke={1.5} />
            </Button>
            <div className="w-8 h-8 rounded-full bg-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center">
              {user.initials}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-[#12141f] p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
