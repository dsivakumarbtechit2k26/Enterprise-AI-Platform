import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { subscribeToTenantChannel, disconnectEcho } from "@/lib/echo";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, Shield, Key, Settings, UserCircle, 
  CreditCard, LogOut, Bell, Menu, Building2 
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

export function AppShell() {
  const { user, tenant, activeTenantId, setMe, clearAuth } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const location = useLocation();
  const navigate = useNavigate();
  const logoutMutation = useLogout();

  const { data: meData } = useGetMe({
    query: {
      enabled: !!activeTenantId,
      queryKey: getGetMeQueryKey(),
    }
  });

  useEffect(() => {
    if (meData) {
      setMe({ 
        user: meData.user, 
        tenant: meData.tenant, 
        permissions: meData.permissions, 
        roles: meData.roles || [] 
      });
    }
  }, [meData, setMe]);

  useEffect(() => {
    if (activeTenantId) {
      subscribeToTenantChannel(activeTenantId);
    }
    return () => {
      disconnectEcho();
    };
  }, [activeTenantId]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        clearAuth();
        navigate("/login");
      }
    });
  };

  const navItems = [
    { label: "Dashboard", path: "/", icon: <LayoutDashboard className="w-4 h-4 mr-2" /> },
    { label: "Roles", path: "/roles", icon: <Shield className="w-4 h-4 mr-2" /> },
    { label: "Permissions", path: "/permissions", icon: <Key className="w-4 h-4 mr-2" /> },
    { label: "Settings", path: "/settings/profile", icon: <Settings className="w-4 h-4 mr-2" /> },
  ];

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-screen bg-muted/20">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b">
          <Building2 className="w-6 h-6 text-primary mr-2" />
          <span className="font-bold tracking-tight truncate">{tenant?.name || "Platform"}</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
                             (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                  ${isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t">
          <div className="flex items-center px-3 py-2 text-sm">
            <Avatar className="h-8 w-8 mr-3 border">
              <AvatarImage src={user?.avatar || undefined} />
              <AvatarFallback>{user?.name ? getInitials(user.name) : "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate">
              <p className="font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-card border-b flex items-center justify-between px-4 sm:px-6 z-10">
          <div className="flex items-center md:hidden">
            <Button variant="ghost" size="icon" className="mr-2">
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-bold">{tenant?.name || "Platform"}</span>
          </div>
          
          <div className="hidden md:flex items-center text-sm text-muted-foreground">
            {/* Simple breadcrumbs */}
            <span className="capitalize">{location.pathname === "/" ? "Dashboard" : location.pathname.split("/").filter(Boolean)[0]}</span>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full"></span>
              )}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8 border">
                    <AvatarImage src={user?.avatar || undefined} />
                    <AvatarFallback>{user?.name ? getInitials(user.name) : "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
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

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
