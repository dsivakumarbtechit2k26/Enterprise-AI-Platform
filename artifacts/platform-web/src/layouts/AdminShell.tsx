import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  ScrollText,
  Settings,
  LogOut,
  Menu,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Layers,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface AdminNavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const ADMIN_NAV: AdminNavItem[] = [
  { label: "Dashboard",      path: "/admin",           icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
  { label: "Tenants",        path: "/admin/tenants",   icon: <Building2 className="w-4 h-4 shrink-0" /> },
  { label: "Users",          path: "/admin/users",     icon: <Users className="w-4 h-4 shrink-0" /> },
  { label: "Plans",          path: "/admin/plans",     icon: <CreditCard className="w-4 h-4 shrink-0" /> },
  { label: "Audit Logs",     path: "/admin/audit-logs",      icon: <ScrollText className="w-4 h-4 shrink-0" /> },
  { label: "Module Builder", path: "/admin/modules",         icon: <Layers className="w-4 h-4 shrink-0" /> },
  { label: "Security Alerts",path: "/admin/security-alerts", icon: <ShieldAlert className="w-4 h-4 shrink-0" /> },
  { label: "Settings",       path: "/admin/settings",        icon: <Settings className="w-4 h-4 shrink-0" /> },
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
}

function AdminNavLinks({
  items,
  currentPath,
  collapsed,
  onNavigate,
}: {
  items: AdminNavItem[];
  currentPath: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className={`space-y-0.5 ${collapsed ? "p-2" : "p-3"}`}>
      {items.map((item) => {
        const isActive =
          item.path === "/admin"
            ? currentPath === "/admin"
            : currentPath.startsWith(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={`flex items-center gap-3 rounded-md transition-colors text-sm font-medium ${
              collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"
            } ${
              isActive
                ? "bg-white/15 text-white"
                : "text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell() {
  const { user, clearAuth } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const breadcrumbs = (() => {
    const segs = location.pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean);
    return segs.map((seg, i) => {
      const path = "/admin/" + segs.slice(0, i + 1).join("/");
      const nav = ADMIN_NAV.find((n) => n.path === path);
      const label = nav?.label ?? (seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "));
      return { label, path };
    });
  })();

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const sidebarContent = (isMobile = false) => (
    <>
      <div className="h-16 flex items-center px-4 border-b border-white/10 shrink-0">
        {!collapsed || isMobile ? (
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="font-bold text-white tracking-tight">Admin Console</span>
          </div>
        ) : (
          <ShieldAlert className="w-5 h-5 text-amber-400 mx-auto" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <AdminNavLinks
          items={ADMIN_NAV}
          currentPath={location.pathname}
          collapsed={!isMobile && collapsed}
          onNavigate={isMobile ? () => setMobileOpen(false) : undefined}
        />
      </div>

      <div className="border-t border-white/10 mt-auto">
        {!collapsed || isMobile ? (
          <>
            <div className="flex items-center px-4 py-3 gap-3">
              <Avatar className="h-8 w-8 border border-white/20 shrink-0">
                <AvatarFallback className="bg-white/10 text-white text-xs">
                  {user?.name ? getInitials(user.name) : "A"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name ?? "Admin"}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="px-3 pb-3 flex flex-col gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/10 h-8"
                asChild
              >
                <Link to="/">← Back to App</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-400/10 h-8"
                onClick={handleLogout}
              >
                <LogOut className="w-3.5 h-3.5 mr-2" /> Log out
              </Button>
            </div>
          </>
        ) : (
          <div className="p-2 flex flex-col gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10 mx-auto"
              onClick={handleLogout}
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}

        {!isMobile && (
          <div className={`flex ${collapsed ? "justify-center" : "justify-end"} px-2 pb-2`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-white hover:bg-white/10"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Desktop sidebar */}
      <aside
        className={`${collapsed ? "w-16" : "w-60"} bg-slate-900 border-r border-white/10 flex-col hidden md:flex transition-all duration-200 shrink-0`}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-60 bg-slate-900 border-r border-white/10 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin Navigation</SheetTitle>
          </SheetHeader>
          {sidebarContent(true)}
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {/* Top bar */}
        <header className="h-14 bg-slate-900 border-b border-white/10 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-slate-400 hover:text-white"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <nav className="hidden md:flex items-center gap-1 text-sm" aria-label="Breadcrumb">
              <Link to="/admin" className="text-slate-400 hover:text-white transition-colors">
                Admin
              </Link>
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.path} className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  {i === breadcrumbs.length - 1 ? (
                    <span className="text-white font-medium">{crumb.label}</span>
                  ) : (
                    <Link to={crumb.path} className="text-slate-400 hover:text-white transition-colors">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-400 font-medium bg-amber-400/10 px-2 py-1 rounded-md">
              Admin Mode
            </span>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
