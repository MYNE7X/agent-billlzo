import { useState } from "react";
import { KeyRound, UserPlus, Loader2, Eye, EyeOff, Copy, Check, Mail, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLinkAgent } from "@/lib/queries";

type Props = {
  agentId: string;
  agentEmail?: string | null;
  agentName: string;
  currentUserId?: string | null;
  onAccountCreated?: () => void;
};

/** Creates a secondary Supabase client that does NOT persist a session,
 *  so creating a new user account doesn't sign out the current admin. */
function makeTempClient() {
  const url = import.meta.env["VITE_SUPABASE_URL"] as string;
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "__billzo_tmp__",
    },
  });
}

export function SetPasswordPanel({ agentId, agentEmail, agentName, currentUserId, onAccountCreated }: Props) {
  const [email, setEmail] = useState(agentEmail ?? "");
  const [tempPassword, setTempPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = useLinkAgent();

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
    let pw = "";
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setTempPassword(pw);
  };

  const copyPassword = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Email is required."); return; }
    if (tempPassword.length < 8) { toast.error("Temporary password must be at least 8 characters."); return; }

    setBusy(true);
    try {
      // Use a non-persistent client so the admin's session is untouched
      const tempClient = makeTempClient();

      const { data, error: signUpErr } = await tempClient.auth.signUp({
        email: email.trim(),
        password: tempPassword,
        options: { data: { full_name: agentName } },
      });

      if (signUpErr) throw signUpErr;
      if (!data.user) throw new Error("Account creation failed — no user returned.");

      const newUserId = data.user.id;

      // Sign out the temp client session immediately (cleanup)
      await tempClient.auth.signOut();

      // Link this account to the agent FIRST.
      // The trg_auto_approve_on_agent_link trigger sets is_approved = true server-side.
      await link.mutateAsync({ agentId, userId: newUserId });

      // Set must_change_password = true.
      // The caller is staff so the security trigger allows this.
      const { error: flagErr } = await supabase
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", newUserId);

      if (flagErr) {
        // Profile row may not exist yet if the DB trigger hasn't fired;
        // use upsert as fallback.
        await supabase.from("profiles").upsert({
          id: newUserId,
          full_name: agentName,
          email: email.trim(),
          must_change_password: true,
          is_approved: true,
        });
      }

      toast.success(
        `Login account created for ${agentName}. Share the temporary password — they must set a new one on first login.`,
        { duration: 8000 }
      );
      onAccountCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setBusy(false);
    }
  };

  // Agent already has a linked account — show the reset flow instead
  if (currentUserId) {
    return <ForceResetPanel userId={currentUserId} agentEmail={agentEmail} agentName={agentName} />;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/50 bg-secondary/10 p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground flex items-center gap-2">
          <UserPlus className="size-4 text-primary" /> Create Login Account
        </p>
        <p>
          Create a Supabase login for this agent with a temporary password. They will be asked to set a new
          password on first login.
        </p>
      </div>

      <form onSubmit={handleCreateAccount} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="agent-email">Agent Email</Label>
          <Input
            id="agent-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="agent@billzo.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="temp-pw">Temporary Password</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="temp-pw"
                type={showPw ? "text" : "password"}
                required
                minLength={8}
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Button type="button" variant="outline" size="icon" onClick={generatePassword} title="Generate password">
              <KeyRound className="size-4" />
            </Button>
            {tempPassword && (
              <Button type="button" variant="outline" size="icon" onClick={copyPassword} title="Copy password">
                {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
              </Button>
            )}
          </div>
          {tempPassword && (
            <p className="text-[11px] text-amber-400/80">
              ⚠ Copy and share this password with the agent before saving — it won't be shown again.
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={busy || link.isPending}>
          {busy || link.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Create Account & Link
        </Button>
      </form>
    </div>
  );
}

/** Panel shown when the agent already has a linked account.
 *
 *  We cannot change their Supabase Auth password from the browser with
 *  the anon key — that requires the service-role key / an Edge Function.
 *  Instead we offer:
 *   A) One-click "Reset Access" — marks forced change + sends reset email together.
 *   B) Manual: mark for forced-change only (agent still uses current password until they log in).
 *   C) Manual: send reset email only.
 */
function ForceResetPanel({
  userId,
  agentEmail,
  agentName,
}: {
  userId: string;
  agentEmail?: string | null | undefined;
  agentName: string;
}) {
  const [busyQuick, setBusyQuick] = useState(false);
  const [busyFlag, setBusyFlag] = useState(false);
  const [busyEmail, setBusyEmail] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const markForReset = async (): Promise<boolean> => {
    const { error } = await supabase
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", userId);
    if (error) throw error;
    return true;
  };

  const sendResetEmail = async (): Promise<boolean> => {
    if (!agentEmail) throw new Error("No email on file for this agent.");
    const { error } = await supabase.auth.resetPasswordForEmail(agentEmail, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) throw error;
    return true;
  };

  /** Quick reset: mark forced change + send email in one shot */
  const handleQuickReset = async () => {
    setBusyQuick(true);
    try {
      await markForReset();
      if (agentEmail) {
        await sendResetEmail();
        toast.success(
          `Password reset email sent to ${agentEmail}. ${agentName} must set a new password on next login.`,
          { duration: 8000 }
        );
      } else {
        toast.success(
          `${agentName} will be prompted to set a new password on their next login.`,
          { duration: 6000 }
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset access.");
    } finally {
      setBusyQuick(false);
    }
  };

  const handleMarkOnly = async () => {
    setBusyFlag(true);
    try {
      await markForReset();
      toast.success(`${agentName} will be asked to set a new password on their next login.`, { duration: 6000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set flag.");
    } finally {
      setBusyFlag(false);
    }
  };

  const handleEmailOnly = async () => {
    setBusyEmail(true);
    try {
      await sendResetEmail();
      toast.success(`Password reset email sent to ${agentEmail}.`, { duration: 6000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setBusyEmail(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300/80 space-y-1">
        <p className="font-semibold text-amber-300 flex items-center gap-2">
          <ShieldAlert className="size-4" /> Account already linked
        </p>
        <p>
          <strong>{agentName}</strong> already has a login account
          {agentEmail ? <> (<span className="font-mono text-xs">{agentEmail}</span>)</> : ""}.
          Use the options below to reset their access.
        </p>
      </div>

      {/* ── Primary: Quick Reset (recommended) ── */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
        <div>
          <p className="font-semibold text-sm flex items-center gap-1.5">
            <KeyRound className="size-4 text-primary" />
            Set New Temporary Password (Recommended)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Locks the account so the agent <strong>must set a new password</strong> on next login,
            and simultaneously sends them a password-reset link via email.
            Share the reset email link with the agent — once they click it, they set their own
            new password immediately.
          </p>
        </div>
        <Button
          className="w-full"
          onClick={handleQuickReset}
          disabled={busyQuick}
        >
          {busyQuick ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <KeyRound className="size-4" />
          )}
          Reset Access{agentEmail ? " & Send Reset Email" : ""}
        </Button>
      </div>

      {/* ── Advanced: individual options ── */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {showAdvanced ? "▲ Hide" : "▼ Show"} individual options
      </button>

      {showAdvanced && (
        <div className="space-y-3 pt-1">
          {/* Force flag only */}
          <div className="rounded-xl border border-border/50 p-4 space-y-3">
            <div>
              <p className="font-medium text-sm">Force change on next login (no email)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Agent can still log in with their current password, but will immediately be
                prompted to create a new one before accessing anything.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
              onClick={handleMarkOnly}
              disabled={busyFlag}
            >
              {busyFlag ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
              Mark for Forced Password Change
            </Button>
          </div>

          {/* Email only */}
          <div className="rounded-xl border border-border/50 p-4 space-y-3">
            <div>
              <p className="font-medium text-sm">Send password reset email only</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sends a secure link to <strong>{agentEmail ?? "their email"}</strong>.
                The agent clicks the link to set a completely new password.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleEmailOnly}
              disabled={busyEmail || !agentEmail}
            >
              {busyEmail ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              Send Password Reset Email
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
