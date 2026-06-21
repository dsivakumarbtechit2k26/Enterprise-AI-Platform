import { useRouteError, isRouteErrorResponse, Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RouteErrorBoundary() {
  const error = useRouteError();

  let title = "Something went wrong";
  let detail = "An unexpected error occurred. Please try refreshing the page.";
  let status: number | null = null;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    if (error.status === 404) {
      title = "Page Not Found";
      detail = "The page you're looking for doesn't exist or has been moved.";
    } else if (error.status === 403) {
      title = "Access Denied";
      detail = "You don't have permission to access this resource.";
    } else {
      detail = error.data?.message ?? error.statusText ?? detail;
    }
  } else if (error instanceof Error) {
    detail = error.message;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background p-4"
      data-testid="page-route-error"
    >
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        {status && (
          <p className="text-6xl font-bold text-muted-foreground/30">{status}</p>
        )}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{detail}</p>
        </div>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh
          </Button>
          <Button asChild>
            <Link to="/">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
