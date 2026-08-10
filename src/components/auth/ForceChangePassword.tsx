import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  onDone: () => void;
};

export function ForceChangePassword({ onDone }: Props) {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      // 1. Update password in Supabase Auth (this is the real password change)
      const { error: authErr } = await supabase.auth.updateUser({ password: newPassword });
      if (authErr) throw authErr;

      // 2. Clear the must_change_password flag on the profile row.
      //    The security trigger allows users to set must_change_password = false
      //    on their own row (only after auth password is successfully changed above).
      if (user?.id) {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", user.id);
        if (profileErr) {
          // Non-fatal: flag will be stale but auth password IS updated.
          console.warn("Could not clear must_change_password flag:", profileErr.message);
        }
      }

      toast.success("Password updated. Welcome to Billzo!");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass animate-rise w-full max-w-md rounded-2xl p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/30">
            <KeyRound className="size-7 text-amber-400" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold">Set Your Password</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You're using a temporary password. Please set a permanent one to continue.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-pw">New Password</Label>
            <Input
              id="new-pw"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw">Confirm Password</Label>
            <Input
              id="confirm-pw"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Set New Password
          </Button>
        </form>
      </div>
    </div>
  );
}
