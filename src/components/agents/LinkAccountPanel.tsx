import { useState } from "react";
import { Link2, Link2Off, UserCheck, UserX, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { useUnlinkedProfiles, useLinkAgent, useProfile } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/billzo";

type Props = {
  agentId: string;
  currentUserId?: string | null;
};

export function LinkAccountPanel({ agentId, currentUserId }: Props) {
  const { data: linkedProfile, isLoading: loadingLinked } = useProfile(currentUserId);
  const { data: unlinked = [], isLoading: loadingUnlinked } = useUnlinkedProfiles(currentUserId);
  const link = useLinkAgent();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = unlinked.filter(
    (p) =>
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleLink = async () => {
    if (!selected) return;
    try {
      await link.mutateAsync({ agentId, userId: selected });
      toast.success("Account linked successfully");
      setSelected(null);
      setSearch("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not link account");
    }
  };

  const handleUnlink = async () => {
    try {
      await link.mutateAsync({ agentId, userId: null });
      toast.success("Account unlinked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not unlink account");
    }
  };

  return (
    <div className="space-y-5">
      {/* current state */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="border-b border-border/40 bg-secondary/20 px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Linked Account</p>
        </div>

        {loadingLinked ? (
          <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking…
          </div>
        ) : linkedProfile ? (
          <div className="flex items-center gap-3 px-4 py-4">
            <Avatar className="size-10">
              <AvatarFallback className="bg-emerald-500/15 text-emerald-400 text-sm">
                {initials(linkedProfile.full_name ?? linkedProfile.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{linkedProfile.full_name ?? "—"}</p>
              <p className="text-xs text-muted-foreground truncate">{linkedProfile.email}</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
              <UserCheck className="size-3" /> Linked
            </span>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleUnlink}
              disabled={link.isPending}
            >
              {link.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Link2Off className="size-3.5" />}
              Unlink
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary/50 ring-1 ring-border/50">
              <UserX className="size-4 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium">No account linked</p>
              <p className="text-xs text-muted-foreground">This agent cannot log in and view their own data yet.</p>
            </div>
          </div>
        )}
      </div>

      {/* link new user */}
      {!linkedProfile && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Link a registered user account
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              className="pl-9"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loadingUnlinked ? (
            <p className="text-sm text-muted-foreground">Loading users…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {search ? "No users match your search." : "No unlinked user accounts found."}
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border/50 divide-y divide-border/30">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(selected === p.id ? null : p.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-secondary/40 ${
                    selected === p.id ? "bg-primary/10 ring-inset ring-1 ring-primary/30" : ""
                  }`}
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/15 text-[11px] text-primary">
                      {initials(p.full_name ?? p.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.full_name ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                  </div>
                  {selected === p.id && (
                    <span className="size-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <span className="size-1.5 rounded-full bg-primary-foreground" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!selected || link.isPending}
            onClick={handleLink}
          >
            {link.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            Link Account
          </Button>
        </div>
      )}

      {/* instructions */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-[12px] text-amber-300/80 space-y-1">
        <p className="font-semibold text-amber-300">How linking works</p>
        <p>When a user signs up, they receive an <em>agent</em> role by default. Link their account here to connect them to this agent profile.</p>
        <p>Once linked, the agent can sign in and view their own attendance, salary, and documents under <strong>My Profile</strong>.</p>
      </div>
    </div>
  );
}
