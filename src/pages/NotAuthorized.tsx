import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";

/**
 * The 403 counterpart to NotFound. Deliberately mirrors that page's layout,
 * typography and centering so a blocked route looks like part of the app rather
 * than a one-off card — the two are the only dead ends a user can land on.
 *
 * Shows the signed-in NTID because the usual first reaction is "but I should
 * have access": naming who the app thinks you are turns a dead end into
 * something the person can actually report.
 */
const NotAuthorized = ({ reason }: { reason?: string }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  useEffect(() => {
    console.warn("403: not authorized for route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">403</h1>
        <p className="mb-4 text-xl text-muted-foreground">
          {reason ?? "You're not authorized to view this page"}
        </p>
        {/* history back, not "/" — the person came from somewhere they CAN see,
            and sending them to the app root loses that. */}
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go back
        </Button>
        {user?.ntid && (
          <p className="mt-6 font-mono text-[11px] text-muted-foreground">
            signed in as {user.ntid}
          </p>
        )}
      </div>
    </div>
  );
};

export default NotAuthorized;
