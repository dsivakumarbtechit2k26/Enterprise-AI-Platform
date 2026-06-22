import { useEffect, useRef, useState, useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { subscribeToTenantChannel, disconnectEcho } from "@/lib/echo";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { fetchEnabledModules } from "@/lib/moduleApi";
import { DynamicIcon } from "@/components/modules/DynamicIcon";
import {
  LayoutDashboard, Shield, Key, Settings, UserCircle,
  CreditCard, LogOut, Bell, Menu, Building2,
  CheckCheck, PanelLeftClose, PanelLeftOpen,
  Search, ChevronRight, Sun, Moon, Layers,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ── Theme toggle ──────────────────────────────────────────────────────────────

function useTheme() {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains("dark"),
  );
  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    setIsDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    }
  }, []);
  return { isDark, toggle };
}

// ── Impersonation banner ──────────────────────────────────────────────────────

interface ImpersonationInfo { tenantName: string; userName: string; startedAt: string; }

function ImpersonationBanner({ onExit }: { onExit: () => void }) {
  const raw = sessionStorage.getItem("impersonating");
  if (!raw) return null;
  let info: ImpersonationInfo;
  try { info = JSON.parse(raw); } catch { return null; }
  return (
    <div className="bg-amber-500 text-amber-950 text-sm font-semibold flex items-center justify-between px-4 py-2 shrink-0 z-50">
      <span>Impersonating <strong>{info.tenantName}</strong> as {info.userName}</span>
      <button onClick={onExit} className="text-xs underline underline-offset-2 hover:no-underline ml-4 font-bold">
        Exit Session
      </button>
    </div>
  );
}

// ── Nav item definition ───────────────────────────────────────────────────────

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
  end?: boolean;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const BASE_NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Dashboard",   path: "/",           icon: <LayoutDashboard className="w-4 h-4 shrink-0" />, end: true },
    ],
  },
  {
    label: "Access Control",
    items: [
      { label: "Roles",       path: "/roles",       icon: <Shield className="w-4 h-4 shrink-0" />,  permission: "roles.view" },
      { label: "Permissions", path: "/permissions", icon: <Key className="w-4 h-4 shrink-0" />,      permission: "permissions.view" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
}

function formatNotificationTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({
  item,
  currentPath,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  currentPath: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const isActive = item.end
    ? currentPath === item.path
    : item.path !== "/" && currentPath.startsWith(item.path);

  const cls = `flex items-center gap-3 rounded-lg transition-all duration-150 text-sm font-medium ${
    collapsed ? "justify-center px-0 py-2.5 w-10 mx-auto" : "px-3 py-2"
  } ${
    isActive
      ? "bg-primary/15 text-primary shadow-sm"
      : "text-[hsl(var(--sidebar-muted-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]"
  }`;

  const link = (
    <Link to={item.path} onClick={onNavigate} className={cls} title={collapsed ? item.label : undefined}>
      <span className={isActive ? "text-primary" : ""}>{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && isActive && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }
  return link;
}

// ── NavLinks (full sidebar groups) ───────────────────────────────────────────

function NavLinks({
  groups,
  currentPath,
  collapsed,
  onNavigate,
  permissions,
}: {
  groups: NavGroup[];
  currentPath: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  permissions: string[];
}) {
  const hasPermission = (perm?: string) => !perm || permissions.includes(perm);

  return (
    <nav className={`flex-1 overflow-y-auto ${collapsed ? "py-3 px-1" : "py-3 px-3"}`}>
      {groups.map((group, gi) => {
        const visible = group.items.filter((i) => hasPermission(i.permission));
        if (visible.length === 0) return null;
        return (
          <div key={gi} className="mb-4">
            {group.label && !collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--sidebar-muted-foreground))]">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {visible.map((item) => (
                <NavLink
                  key={item.path}
                  item={item}
                  currentPath={currentPath}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export function AppShell() {
  const { token, user, tenant, activeTenantId, permissions, setMe, clearAuth, hasPermission } = useAuthStore();
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore();
  const { isDark, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const logoutMutation = useLogout();
  const [mobileOpen, setMobileOpen]             = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isImpersonating]                       = useState(() => !!sessionStorage.getItem("impersonating"));
  const notifiedIds = useRef<Set<string>>(new Set());

  // ── Dynamic modules from API ──────────────────────────────────────────────

  const { data: modulesData } = useQuery({
    queryKey: ["platform-modules"],
    queryFn: fetchEnabledModules,
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
  });

  const dynamicModules = modulesData?.data ?? [];

  const NAV_GROUPS: NavGroup[] = useMemo(() => {
    const groups = [...BASE_NAV_GROUPS];
    if (dynamicModules.length > 0) {
      groups.push({
        label: "Modules",
        items: dynamicModules.map((m) => ({
          label: m.name,
          path: `/m/${m.slug}`,
          icon: <DynamicIcon name={m.icon} className="w-4 h-4 shrink-0" />,
        })),
      });
    }
    return groups;
  }, [dynamicModules]);

  const ALL_NAV_ITEMS = useMemo(() => NAV_GROUPS.flatMap((g) => g.items), [NAV_GROUPS]);

  // ── Hydrate user/tenant/permissions ──────────────────────────────────────

  const { data: meData } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
    },
  });

  useEffect(() => {
    if (meData) {
      setMe({
        user: meData.user,
        tenant: meData.tenant,
        permissions: meData.permissions ?? [],
        roles: meData.roles ?? [],
      });
    }
  }, [meData, setMe]);

  // ── Echo subscription ─────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTenantId) subscribeToTenantChannel(activeTenantId);
    return () => { disconnectEcho(); };
  }, [activeTenantId]);

  // ── High-priority notification toasts ────────────────────────────────────

  useEffect(() => {
    const latest = notifications[0];
    if (!latest || latest.read) return;
    if (notifiedIds.current.has(latest.id)) return;
    if (latest.priority === "high" || latest.priority === "critical") {
      notifiedIds.current.add(latest.id);
      toast({
        title: latest.title,
        description: latest.body,
        variant: latest.priority === "critical" ? "destructive" : "default",
      });
    }
  }, [notifications, toast]);

  // ── Breadcrumbs ───────────────────────────────────────────────────────────

  const breadcrumbs = useMemo(() => {
    const segs = location.pathname.split("/").filter(Boolean);
    if (segs.length === 0) return [];
    return segs.map((seg, i) => {
      const path = "/" + segs.slice(0, i + 1).join("/");
      const nav = ALL_NAV_ITEMS.find(
        (n) => n.path === path || (n.path !== "/" && path.startsWith(n.path)),
      );
      const label = nav?.label ?? (seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "));
      return { label, path };
    });
  }, [location.pathname]);

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => { clearAuth(); navigate("/login"); },
    });
  };

  const handleExitImpersonation = () => {
    sessionStorage.removeItem("impersonating");
    clearAuth();
    navigate("/login");
  };

  // ── Sidebar header ────────────────────────────────────────────────────────

  const sidebarHeader = (
    <div className={`h-14 flex items-center shrink-0 border-b border-[hsl(var(--sidebar-border))] ${sidebarCollapsed ? "justify-center px-2" : "px-4 gap-2.5"}`}>
      <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
        <Building2 className="w-4 h-4 text-white" />
      </div>
      {!sidebarCollapsed && (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[hsl(var(--sidebar-foreground))] truncate leading-tight">
            {tenant?.name || "Enterprise"}
          </p>
          <p className="text-[10px] text-[hsl(var(--sidebar-muted-foreground))] leading-tight">Platform</p>
        </div>
      )}
    </div>
  );

  // ── Sidebar footer ────────────────────────────────────────────────────────

  const sidebarFooter = (
    <div className="shrink-0 border-t border-[hsl(var(--sidebar-border))] p-3">
      <div className={`flex items-center ${sidebarCollapsed ? "flex-col gap-2" : "gap-2"}`}>
        {/* Theme toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-[hsl(var(--sidebar-muted-foreground))] hover:text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{isDark ? "Light mode" : "Dark mode"}</TooltipContent>
        </Tooltip>

        {/* Collapse toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-[hsl(var(--sidebar-muted-foreground))] hover:text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{sidebarCollapsed ? "Expand" : "Collapse"}</TooltipContent>
        </Tooltip>

        {/* User avatar (only when expanded) */}
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0 ml-1">
            <Avatar className="h-7 w-7 shrink-0 border border-[hsl(var(--sidebar-border))]">
              <AvatarImage src={user?.avatar ?? undefined} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {user?.name ? getInitials(user.name) : "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[hsl(var(--sidebar-foreground))] truncate leading-tight">{user?.name ?? "…"}</p>
              <p className="text-[10px] text-[hsl(var(--sidebar-muted-foreground))] truncate leading-tight">{user?.email}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Full sidebar ──────────────────────────────────────────────────────────

  const sidebarContent = (onNavigate?: () => void) => (
    <div className="flex flex-col h-full bg-[hsl(var(--sidebar))]">
      {sidebarHeader}
      <NavLinks
        groups={NAV_GROUPS}
        currentPath={location.pathname}
        collapsed={sidebarCollapsed}
        onNavigate={onNavigate}
        permissions={permissions ?? []}
      />
      {sidebarFooter}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {isImpersonating && <ImpersonationBanner onExit={handleExitImpersonation} />}

      <div className="flex flex-1 min-h-0">
        {/* ── Desktop sidebar ───────────────────────────────────────────── */}
        <aside
          className={`${sidebarCollapsed ? "w-[60px]" : "w-60"} hidden md:flex flex-col shrink-0 transition-all duration-200 border-r border-[hsl(var(--sidebar-border))]`}
        >
          {sidebarContent()}
        </aside>

        {/* ── Mobile drawer ─────────────────────────────────────────────── */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-60 border-r border-[hsl(var(--sidebar-border))]">
            <SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle></SheetHeader>
            {sidebarContent(() => setMobileOpen(false))}
          </SheetContent>
        </Sheet>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* ── Top header ────────────────────────────────────────────────── */}
          <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 z-10 shrink-0 gap-3">

            {/* Left */}
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" className="md:hidden shrink-0 h-8 w-8" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                <Menu className="w-4 h-4" />
              </Button>

              {/* Breadcrumb */}
              <nav className="hidden md:flex items-center gap-1 text-sm min-w-0" aria-label="Breadcrumb">
                <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors shrink-0 text-xs">
                  Home
                </Link>
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb.path} className="flex items-center gap-1 min-w-0">
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    {i === breadcrumbs.length - 1 ? (
                      <span className="text-xs font-medium text-foreground truncate">{crumb.label}</span>
                    ) : (
                      <Link to={crumb.path} className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate">
                        {crumb.label}
                      </Link>
                    )}
                  </span>
                ))}
              </nav>

              <span className="md:hidden text-sm font-semibold truncate">{tenant?.name || "Platform"}</span>
            </div>

            {/* Right */}
            <div className="flex items-center gap-1.5 shrink-0">

              {/* Search */}
              <div className="relative hidden lg:flex items-center">
                <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Search…"
                  className="pl-8 h-8 w-44 xl:w-60 bg-muted/40 border-border/50 text-xs"
                  aria-label="Search"
                />
              </div>

              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notifications">
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    {unreadCount > 0 && (
                      <Badge variant="destructive" className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[9px] flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80" forceMount>
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <span className="text-sm font-semibold">Notifications</span>
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={() => markAllRead()}>
                        <CheckCheck className="w-3 h-3 mr-1" /> Mark all read
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-72">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                        <Bell className="w-7 h-7 mb-2 opacity-20" />
                        <span className="text-xs">No notifications</span>
                      </div>
                    ) : (
                      notifications.slice(0, 20).map((n) => (
                        <div
                          key={n.id}
                          className={`px-3 py-2.5 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                          onClick={() => markRead(n.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold truncate ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatNotificationTime(n.created_at)}</span>
                              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarImage src={user?.avatar ?? undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {user?.name ? getInitials(user.name) : "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal py-2">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-semibold leading-none">{user?.name ?? "…"}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings/profile" className="w-full flex items-center cursor-pointer">
                      <UserCircle className="w-4 h-4 mr-2" /> Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings/security" className="w-full flex items-center cursor-pointer">
                      <Shield className="w-4 h-4 mr-2" /> Security
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings/billing" className="w-full flex items-center cursor-pointer">
                      <CreditCard className="w-4 h-4 mr-2" /> Billing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                    {isDark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                    {isDark ? "Light mode" : "Dark mode"}
                  </DropdownMenuItem>
                  {hasPermission("platform.admin") && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="w-full flex items-center cursor-pointer text-primary">
                          <Settings className="w-4 h-4 mr-2" /> Admin Console
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto p-5 sm:p-7">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
