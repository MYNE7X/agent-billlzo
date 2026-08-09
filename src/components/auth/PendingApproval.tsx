import { Clock, LogOut, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function PendingApproval() {
  const { signOut, profile } = useAuth();

  return (
    <div className="surface-grid flex min-h-screen items-center justify-center p-6">
      <div className="glass animate-rise w-full max-w-md rounded-2xl p-8 text-center shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-4">
          <span className="grid size-16 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
            <Building2 className="size-8 text-primary" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold text-gradient">Account Pending</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Hi {profile?.full_name ?? "there"} 👋
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300/90 space-y-2">
          <div className="flex items-center justify-center gap-2 font-semibold text-amber-300">
            <Clock className="size-4" />
            Not Approved Yet
          </div>
          <p>
            Your account has been created but is waiting for approval by an administrator.
          </p>
          <p className="text-xs text-amber-300/70">
            This usually happens when you self-registered. A Super Admin or Admin needs to approve your account or link it to your agent profile.
          </p>
        </div>

        <div className="space-y-3 text-xs text-muted-foreground">
          <p>Please contact your administrator to:</p>
          <ul className="space-y-1 text-left list-disc list-inside">
            <li>Link your account to your agent profile</li>
            <li>Or manually approve your account</li>
          </ul>
        </div>

        <Button
          variant="outline"
          className="mt-6 w-full"
          onClick={() => void signOut()}
        >
          <LogOut className="size-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
