import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { subscribeToTenantChannel, disconnectEcho } from "@/lib/echo";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Shield, Key, Settings, UserCircle,
  CreditCard, LogOut, Bell, Menu, Building2, X,
  CheckCheck,
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

// ── Nav item definition ───────────────────────────────────────────────────────

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",   path: "/",                icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: "Roles",       path: "/roles",            icon: <Shield className="w-4 h-4" />, permission: "roles.view" },
  { label: "Permissions", path: "/permissions",      icon: <Key className="w-4 h-4" />,    permission: "permissions.view" },
  { label: "Settings",    path: "/settings/profile", icon: <Settings className="w-4 h-4" /> },
];

// ── Helper ────────────────────────────────────────────────────────────────────

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

// ── NavLinks shared between sidebar and mobile drawer ────────────────────────

function NavLinks({
  items,
  currentPath,
  onNavigate,
}: {
  items: NavItem[];
  currentPath: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1 p-4">
      {items.map((item) => {
        const isActive =
          currentPath === item.path ||
          (item.path !== "/" && currentPath.startsWith(item.path));
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export function AppShell() {
  const { token, user, tenant, activeTenantId, setMe, clearAuth, hasPermission } = useAuthStore();
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const logoutMutation = useLogout();
  const [mobileOpen, setMobileOpen] = useState(false);
  const notifiedIds = useRef<Set<string>>(new Set());

  // ── Hydrate user/tenant/permissions ──────────────────────────────────────
  // Gate on token (not activeTenantId) so OAuth callbacks — which set token
  // but leave user/tenant null — still trigger the /me fetch.

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
        permissions: meData.permissions,
        roles: meData.roles || [],
      });
    }
  }, [meData, setMe]);

  // ── Echo subscription ─────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTenantId) {
      subscribeToTenantChannel(activeTenantId);
    }
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

  // ── Permission-filtered nav items ─────────────────────────────────────────

  const navItems = ALL_NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        clearAuth();
        navigate("/login");
      },
    });
  };

  // ── Sidebar content (shared between desktop & mobile drawer) ─────────────

  const sidebarContent = (
    <>
      <div className="h-16 flex items-center px-6 border-b shrink-0">
        <Building2 className="w-6 h-6 text-primary mr-2 shrink-0" />
        <span className="font-bold tracking-tight truncate">{tenant?.name || "Platform"}</span>
      </div>
      <NavLinks
        items={navItems}
        currentPath={location.pathname}
        onNavigate={() => setMobileOpen(false)}
      />
      <div className="mt-auto p-4 border-t">
        <div className="flex items-center px-3 py-2 text-sm">
          <Avatar className="h-8 w-8 mr-3 border shrink-0">
            <AvatarImage src={user?.avatar ?? undefined} />
            <AvatarFallback>{user?.name ? getInitials(user.name) : "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{user?.name ?? "Loading…"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-muted/20">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="w-64 bg-sidebar border-r flex-col hidden md:flex">
        {sidebarContent}
      </aside>

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-card border-b flex items-center justify-between px-4 sm:px-6 z-10 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Breadcrumb (desktop) */}
            <span className="hidden md:block text-sm text-muted-foreground capitalize">
              {location.pathname === "/" ? "Dashboard" : location.pathname.split("/").filter(Boolean)[0]}
            </span>

            {/* Tenant name (mobile) */}
            <span className="md:hidden font-semibold">{tenant?.name || "Platform"}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* ── Notification bell ──────────────────────────────────── */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center"
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80" forceMount>
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground"
                      onClick={() => markAllRead()}
                    >
                      <CheckCheck className="w-3 h-3 mr-1" /> Mark all read
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-80">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                      <Bell className="w-8 h-8 mb-2 opacity-30" />
                      No notifications yet
                    </div>
                  ) : (
                    notifications.slice(0, 20).map((n) => (
                      <div
                        key={n.id}
                        className={`px-3 py-2.5 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                          !n.read ? "bg-primary/5" : ""
                        }`}
                        onClick={() => markRead(n.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>
                              {n.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {n.body}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatNotificationTime(n.created_at)}
                            </span>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* ── User avatar dropdown ───────────────────────────────── */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8 border">
                    <AvatarImage src={user?.avatar ?? undefined} />
                    <AvatarFallback>{user?.name ? getInitials(user.name) : "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name ?? "Loading…"}</p>
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
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 sm:p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
