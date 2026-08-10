import { Clock, LogOut, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function PendingApproval() {
  const { signOut, profile } = useAuth();

  return (
    <div className="surface-grid relative flex min-h-screen items-center justify-center p-6">
      {/* ambient aurora */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/3 h-[32rem] w-[32rem] -translate-x-1/2 animate-aurora rounded-full opacity-40 blur-[120px]"
          style={{ background: "radial-gradient(circle, oklch(0.78 0.16 184 / 0.55), transparent 70%)" }}
        />
        <div
          className="absolute right-0 bottom-0 h-[24rem] w-[24rem] animate-aurora rounded-full opacity-30 blur-[100px]"
          style={{
            background: "radial-gradient(circle, oklch(0.7 0.22 350 / 0.55), transparent 70%)",
            animationDelay: "-8s",
          }}
        />
      </div>
      <div className="aurora-border glass animate-rise relative w-full max-w-md rounded-3xl p-8 text-center">
        <span className="aurora-border-ring" />
        <div className="relative mb-6 flex flex-col items-center gap-4">
          <span className="relative grid size-16 place-items-center overflow-hidden rounded-2xl">
            <span className="absolute inset-0 bg-gradient-to-br from-primary via-cyan-400 to-fuchsia-500 opacity-95" />
            <span className="absolute -inset-3 animate-aurora bg-gradient-to-br from-primary/40 via-fuchsia-500/40 to-violet-500/40 blur-lg" />
            <Building2 className="relative size-7 text-background" strokeWidth={2.4} />
          </span>
          <div>
            <h2 className="font-display text-2xl font-bold text-gradient-aurora">Account Pending</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Hi {profile?.full_name ?? "there"} 👋
            </p>
          </div>
        </div>

        <div className="relative mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300/90 space-y-2">
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

        <div className="relative space-y-3 text-xs text-muted-foreground">
          <p>Please contact your administrator to:</p>
          <ul className="space-y-1 text-left list-disc list-inside">
            <li>Link your account to your agent profile</li>
            <li>Or manually approve your account</li>
          </ul>
        </div>

        <Button
          variant="outline"
          className="relative mt-6 w-full"
          onClick={() => void signOut()}
        >
          <LogOut className="size-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
