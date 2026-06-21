import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/20">
      <Card className="w-full max-w-md mx-4 shadow-sm border-destructive/20">
        <CardContent className="pt-8 pb-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-8">
            You don't have the necessary permissions to view this page. If you believe this is an error, please contact your organization administrator.
          </p>
          
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" /> Return to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
