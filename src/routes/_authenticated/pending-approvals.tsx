import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UserCheck, UserX, Clock, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePendingUsers, useApproveUser } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/billzo";

export const Route = createFileRoute("/_authenticated/pending-approvals")({
  component: PendingApprovalsPage,
});

function PendingApprovalsPage() {
  const { isStaff } = useAuth();
  const navigate = useNavigate();
  const { data: pending = [], isLoading } = usePendingUsers();
  const approve = useApproveUser();

  if (!isStaff) {
    void navigate({ to: "/dashboard" });
    return null;
  }

  const handleApprove = async (userId: string, name: string) => {
    try {
      await approve.mutateAsync(userId);
      toast.success(`${name} approved — they can now access the system.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve user.");
    }
  };

  return (
    <div className="space-y-6 animate-rise">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Pending Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Users who self-registered and are waiting for account approval.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : pending.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center">
          <UserCheck className="mx-auto size-10 text-emerald-400/60 mb-3" />
          <p className="font-medium">No pending approvals</p>
          <p className="text-sm text-muted-foreground mt-1">All registered users have been reviewed.</p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden divide-y divide-border/30">
          {pending.map((user) => (
            <div key={user.id} className="flex items-center gap-4 px-5 py-4">
              <Avatar className="size-10 shrink-0">
                <AvatarFallback className="bg-amber-500/15 text-amber-400 text-sm">
                  {initials(user.full_name ?? user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{user.full_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-amber-300/80 bg-amber-500/10 rounded-full px-2.5 py-1 ring-1 ring-amber-500/20 shrink-0">
                <Clock className="size-3" /> Pending
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => handleApprove(user.id, user.full_name ?? user.email ?? "User")}
                  disabled={approve.isPending}
                >
                  {approve.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <UserCheck className="size-3.5" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border/40 bg-secondary/10 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground/70 flex items-center gap-2">
          <ShieldAlert className="size-3.5" /> How approval works
        </p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Self-registered accounts start as <strong>not approved</strong> and cannot access the system.</li>
          <li>Approving a user here marks them as approved so they can log in.</li>
          <li>Alternatively, go to an <strong>Agent Profile → Login / Password tab</strong> to create a linked account directly — that account is auto-approved.</li>
          <li>Super Admins and Admins are always auto-approved when their role is assigned.</li>
        </ul>
      </div>
    </div>
  );
}
