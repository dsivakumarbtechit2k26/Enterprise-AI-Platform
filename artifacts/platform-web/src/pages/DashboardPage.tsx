import { useAuthStore } from "@/stores/authStore";
import { useGetSubscription } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Users, Shield, Key, ArrowRight, Activity, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: subData, isLoading } = useGetSubscription();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getQuotaPercentage = (used?: number, limit?: number | null) => {
    if (!used || !limit) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {getGreeting()}, {user?.name?.split(' ')[0] || "User"}
        </h1>
        <p className="text-muted-foreground mt-2">
          Here's what's happening in your organization today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{subData?.subscription?.quota?.users_count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  of {subData?.subscription?.quota?.users_limit || "unlimited"} allowed
                </p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card className="hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Calls</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{(subData?.subscription?.quota?.api_calls_used || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  this billing cycle
                </p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2 hover-elevate transition-all border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription Status</CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2 mt-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full" />
              </div>
            ) : (
              <div className="space-y-3 mt-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-lg capitalize">{subData?.subscription?.plan_name || subData?.subscription?.plan_key || "Free"} Plan</span>
                  <span className="text-muted-foreground capitalize">{subData?.subscription?.status}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>API Usage</span>
                    <span>{getQuotaPercentage(subData?.subscription?.quota?.api_calls_used, subData?.subscription?.quota?.api_calls_limit)}%</span>
                  </div>
                  <Progress 
                    value={getQuotaPercentage(subData?.subscription?.quota?.api_calls_used, subData?.subscription?.quota?.api_calls_limit)} 
                    className="h-2" 
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Access Control</CardTitle>
            <CardDescription>Manage who has access to your organization's resources.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="flex items-start space-x-4 border rounded-lg p-4">
              <div className="bg-primary/10 p-2 rounded-full">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-medium leading-none">Roles</p>
                <p className="text-sm text-muted-foreground">Configure job functions and assign users.</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/roles">Manage</Link>
              </Button>
            </div>
            
            <div className="flex items-start space-x-4 border rounded-lg p-4">
              <div className="bg-primary/10 p-2 rounded-full">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-medium leading-none">Permissions</p>
                <p className="text-sm text-muted-foreground">View available system permissions.</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/permissions">View</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest events within your workspace.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-8">
              {/* Placeholder activity items */}
              <div className="flex items-center">
                <span className="relative flex h-2 w-2 mr-4 bg-primary rounded-full"></span>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Logged in successfully</p>
                  <p className="text-xs text-muted-foreground">Just now</p>
                </div>
              </div>
              <div className="flex items-center">
                <span className="relative flex h-2 w-2 mr-4 bg-muted-foreground rounded-full"></span>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Workspace created</p>
                  <p className="text-xs text-muted-foreground">System generated</p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="ghost" className="w-full justify-between" disabled>
              View all activity <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
