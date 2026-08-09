import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ShieldCheck, ShieldHalf, ShieldAlert, UserCog, KeyRound, Mail, Trash2,
  Loader2, Search, Crown, UserCheck, Users, Clock, Activity, Sparkles,
  Lock, Unlock, ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2,
  Filter, ChevronDown, History, Shield, X, RefreshCw, ImageOff,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { useStaffProfiles, usePendingUsers, useApproveUser } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import {
  useSetUserRole, useRemoveUserRole, useForcePasswordChange,
  useSendPasswordReset, useActivityLogs, useAllUsers,
} from "@/lib/admin-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initials, labelize, formatTime, formatDate } from "@/lib/billzo";
import type { AppRole } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/admins")({
  component: AdminsAndRolesPage,
});

/* ============================================================
 *  Admins & Roles — Super Admin only
 *  Unique premium design: hero stats, role matrix, action hub,
 *  pending approvals inline, activity timeline.
 * ============================================================ */

// Accounts in this list are fully protected: no super admin can change,
// remove, or assign roles for them, force a password change, or send a
// reset email from this screen. Only their profile is shown.
const PROTECTED_EMAILS = ["myne7x@gmail.com"];
const isProtectedUser = (email: string | null | undefined) =>
  !!email && PROTECTED_EMAILS.includes(email.toLowerCase());

function AdminsAndRolesPage() {
  const { isSuperAdmin, profile } = useAuth();
  const navigate = useNavigate();

  // Guard: only super_admins may view this page
  if (!isSuperAdmin) {
    void navigate({ to: "/dashboard" });
    return null;
  }

  const { data: staff = [], isLoading: loadingStaff } = useStaffProfiles();
  const { data: allUsers = [], isLoading: loadingAll } = useAllUsers();
  const { data: pending = [], isLoading: loadingPending } = usePendingUsers();
  const { data: activity = [], isLoading: loadingActivity } = useActivityLogs(50);

  const [tab, setTab] = useState("staff");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");

  /* ── derived counts ── */
  const counts = useMemo(() => {
    const superAdmins = staff.filter((s) => s.roles.includes("super_admin")).length;
    const admins = staff.filter((s) => s.roles.includes("admin") && !s.roles.includes("super_admin")).length;
    const agents = allUsers.filter((u) =>
      u.roles.length === 0 || u.roles.every((r) => r === "agent")
    ).length;
    return {
      total: allUsers.length,
      superAdmins,
      admins,
      agents,
      pending: pending.length,
    };
  }, [staff, allUsers, pending]);

  /* ── filtered staff list ── */
  const filteredStaff = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter((u) => {
      if (roleFilter !== "all" && !u.roles.includes(roleFilter)) return false;
      if (!q) return true;
      return (
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [staff, query, roleFilter]);

  return (
    <div className="space-y-7 animate-rise">
      {/* ───────────── HERO HEADER ───────────── */}
      <header className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-secondary/70 via-secondary/30 to-primary/8 p-6 shadow-xl shadow-black/20 sm:p-8">
        {/* Decorative glows */}
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 size-56 rounded-full bg-info/6 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="absolute -inset-2 rounded-2xl bg-primary/10 blur-md" />
              <div className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
                <ShieldCheck className="size-7 text-primary" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  Admins &amp; Roles
                </h1>
                <Badge className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15">
                  <Crown className="mr-1 size-3" /> Super Admin
                </Badge>
              </div>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Manage staff accounts, assign roles, reset passwords, approve pending users, and audit
                system activity — all in one place.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <AssignRoleDialog trigger={
              <Button className="gap-2">
                <UserCog className="size-4" /> Assign Role
              </Button>
            } />
          </div>
        </div>

        {/* ───────────── STAT STRIP ───────────── */}
        <div className="relative mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Total Users" value={counts.total} icon={Users} tone="primary" />
          <StatTile label="Super Admins" value={counts.superAdmins} icon={Crown} tone="warning" />
          <StatTile label="Admins" value={counts.admins} icon={ShieldHalf} tone="info" />
          <StatTile label="Agents" value={counts.agents} icon={UserCheck} tone="success" />
          <StatTile label="Pending" value={counts.pending} icon={Clock} tone="destructive" />
        </div>
      </header>

      {/* ───────────── TABS ───────────── */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full bg-secondary/50">
            <TabsTrigger value="staff" className="gap-1.5">
              <ShieldHalf className="size-3.5" /> Staff
              <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">
                {staff.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="size-3.5" /> All Users
              <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">
                {allUsers.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-1.5">
              <Clock className="size-3.5" /> Pending
              {counts.pending > 0 && (
                <span className="ml-1 rounded-full bg-destructive/20 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                  {counts.pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5">
              <Activity className="size-3.5" /> Activity Log
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ───────────── STAFF TAB ───────────── */}
        <TabsContent value="staff" className="space-y-4">
          {/* Toolbar */}
          <div className="glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                className="pl-9"
                placeholder="Search by name or email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as "all" | AppRole)}>
              <SelectTrigger className="sm:w-44">
                <Filter className="mr-2 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Staff grid */}
          {loadingStaff ? (
            <LoadingState label="Loading staff…" />
          ) : filteredStaff.length === 0 ? (
            <EmptyState
              icon={ShieldHalf}
              title="No staff members found"
              subtitle={query ? "Try adjusting your search." : "Use the Assign Role button to promote a user."}
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {filteredStaff.map((user) => (
                <StaffCard
                  key={user.id}
                  user={user}
                  currentUserId={profile?.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ───────────── ALL USERS TAB ───────────── */}
        <TabsContent value="users" className="space-y-4">
          {loadingAll ? (
            <LoadingState label="Loading users…" />
          ) : allUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users yet"
              subtitle="Self-registered accounts will appear here."
            />
          ) : (
            <div className="glass overflow-hidden rounded-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-secondary/30">
                      <Th>User</Th>
                      <Th>Email</Th>
                      <Th>Roles</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {allUsers.map((u) => {
                      const protectedUser = isProtectedUser(u.email);
                      return (
                        <tr key={u.id} className="transition-colors hover:bg-secondary/20">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="size-8">
                                <AvatarFallback className="bg-primary/15 text-[11px] text-primary">
                                  {initials(u.full_name ?? u.email)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{u.full_name ?? "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {u.roles.length === 0 ? (
                                <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                                  no role
                                </span>
                              ) : (
                                u.roles.map((r) => <RoleBadge key={r} role={r} />)
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {u.is_approved ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/25">
                                <CheckCircle2 className="size-3" /> Approved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 ring-1 ring-amber-500/25">
                                <Clock className="size-3" /> Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {protectedUser ? (
                              <ProtectedBadge />
                            ) : (
                              <UserActionMenu userId={u.id} email={u.email} name={u.full_name} roles={u.roles} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ───────────── PENDING TAB ───────────── */}
        <TabsContent value="pending" className="space-y-4">
          <PendingApprovalsPanel />
        </TabsContent>

        {/* ───────────── ACTIVITY LOG TAB ───────────── */}
        <TabsContent value="activity" className="space-y-4">
          <ActivityLogPanel activity={activity} loading={loadingActivity} />
        </TabsContent>
      </Tabs>

      {/* ───────────── ROLE-MODEL HELP CARD ───────────── */}
      <section className="glass rounded-2xl p-5 text-sm">
        <h3 className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-primary" /> How roles work in Billzo
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <RoleHelpCard
            icon={Crown}
            tone="warning"
            title="Super Admin"
            desc="Full system access. Can manage admins, agents, view & edit all data, export reports, and control system settings."
          />
          <RoleHelpCard
            icon={ShieldHalf}
            tone="info"
            title="Admin"
            desc="Manages assigned agents, adds new agents, edits agent info, manages attendance, and views reports."
          />
          <RoleHelpCard
            icon={UserCheck}
            tone="success"
            title="Agent"
            desc="Views own profile, marks attendance, updates allowed info, and uploads required documents."
          />
        </div>
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[12px] text-amber-300/80">
          <p className="flex items-center gap-2 font-semibold text-amber-300">
            <AlertTriangle className="size-3.5" /> Important
          </p>
          <p className="mt-1">
            Promoting a user to <strong>Admin</strong> or <strong>Super Admin</strong> automatically approves their account.
            Demoting a staff member to Agent does NOT unapprove them — they will still be able to log in.
          </p>
        </div>
      </section>
    </div>
  );
}

/* ============================================================
 *  Staff Card — premium glass card with role badge + actions
 * ============================================================ */
function StaffCard({
  user,
  currentUserId,
}: {
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
    roles: AppRole[];
    is_approved?: boolean;
    must_change_password?: boolean;
  };
  currentUserId?: string;
}) {
  const isSelf = user.id === currentUserId;
  const protectedUser = isProtectedUser(user.email);
  const primaryRole: AppRole = user.roles.includes("super_admin")
    ? "super_admin"
    : user.roles.includes("admin")
      ? "admin"
      : "agent";

  return (
    <div className="glass glass-hover glass-hover-on group relative overflow-hidden rounded-2xl p-5">
      {/* glow line on top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <Avatar className="size-12 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
            <AvatarFallback className={`text-sm font-bold ${ROLE_AVATAR_COLOR[primaryRole]}`}>
              {initials(user.full_name ?? user.email)}
            </AvatarFallback>
          </Avatar>
          <span className={`absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-background ${ROLE_DOT_COLOR[primaryRole]}`}>
            {ROLE_ICON[primaryRole] && (() => {
              const Icon = ROLE_ICON[primaryRole]!;
              return <Icon className="size-2.5 text-background" />;
            })()}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold leading-tight">{user.full_name ?? "—"}</p>
                {isSelf && (
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                    You
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email ?? "—"}</p>
            </div>
            {protectedUser ? (
              <ProtectedBadge />
            ) : (
              <UserActionMenu
                userId={user.id}
                email={user.email}
                name={user.full_name}
                roles={user.roles}
                isSelf={isSelf}
                avatarUrl={user.avatar_url}
              />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {user.roles.length === 0 ? (
              <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                No role assigned
              </span>
            ) : (
              user.roles.map((r) => <RoleBadge key={r} role={r} />)
            )}
            {user.must_change_password && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 ring-1 ring-amber-500/25">
                <KeyRound className="size-2.5" /> Must change pw
              </span>
            )}
            {protectedUser && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border/50">
                <Lock className="size-2.5" /> Protected account
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 *  Protected Badge — shown instead of the action menu for
 *  accounts in PROTECTED_EMAILS. Profile-only, no actions.
 * ============================================================ */
function ProtectedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
      <Lock className="size-3" /> Protected
    </span>
  );
}

/* ============================================================
 *  User Action Menu — change role, reset password, remove role
 * ============================================================ */
function UserActionMenu({
  userId,
  email,
  name,
  roles,
  isSelf,
  avatarUrl,
}: {
  userId: string;
  email: string | null;
  name: string | null;
  roles: AppRole[];
  isSelf?: boolean;
  avatarUrl?: string | null;
}) {
  const setRole = useSetUserRole();
  const removeRole = useRemoveUserRole();
  const forcePw = useForcePasswordChange();
  const sendReset = useSendPasswordReset();
  const [deletingAvatar, setDeletingAvatar] = useState(false);

  const handleSetRole = async (role: AppRole) => {
    try {
      await setRole.mutateAsync({ userId, role });
      toast.success(`${name ?? "User"} is now ${labelize(role)}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign role.");
    }
  };

  const handleRemoveRole = async (role: AppRole) => {
    if (isSelf && role === "super_admin") {
      toast.error("You cannot remove your own Super Admin role.");
      return;
    }
    try {
      await removeRole.mutateAsync({ userId, role });
      toast.success(`Removed ${labelize(role)} role from ${name ?? "user"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove role.");
    }
  };

  const handleForcePw = async () => {
    try {
      await forcePw.mutateAsync(userId);
      toast.success(`${name ?? "User"} will be asked to set a new password on next login.`, { duration: 6000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set flag.");
    }
  };

  const handleSendReset = async () => {
    if (!email) {
      toast.error("No email on file for this user.");
      return;
    }
    try {
      await sendReset.mutateAsync(email);
      toast.success(`Password reset email sent to ${email}.`, { duration: 6000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send reset email.");
    }
  };

  const handleDeleteAvatar = async () => {
    if (!avatarUrl) return;
    if (!confirm(`Delete ${name ?? "this user"}'s profile picture? This cannot be undone.`)) return;
    setDeletingAvatar(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Profile picture removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete picture");
    } finally {
      setDeletingAvatar(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          Actions <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Assign Role
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleSetRole("super_admin")} disabled={isSelf || roles.includes("super_admin")}>
          <Crown className="mr-2 size-3.5 text-amber-400" /> Promote to Super Admin
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetRole("admin")} disabled={roles.includes("admin")}>
          <ShieldHalf className="mr-2 size-3.5 text-info" /> Promote to Admin
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetRole("agent")} disabled={roles.includes("agent")}>
          <UserCheck className="mr-2 size-3.5 text-emerald-400" /> Set as Agent
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Password
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={handleForcePw}>
          <KeyRound className="mr-2 size-3.5 text-amber-400" /> Force change on next login
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSendReset} disabled={!email}>
          <Mail className="mr-2 size-3.5 text-info" /> Send password reset email
        </DropdownMenuItem>

        {/* Profile picture delete — only shown when the user has one */}
        {avatarUrl && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Profile Picture
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={handleDeleteAvatar}
              disabled={deletingAvatar}
              className="text-destructive focus:text-destructive"
            >
              <ImageOff className="mr-2 size-3.5" />
              {deletingAvatar ? "Deleting…" : "Delete Profile Picture"}
            </DropdownMenuItem>
          </>
        )}

        {roles.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Remove Role
            </DropdownMenuLabel>
            {roles.map((r) => (
              <DropdownMenuItem
                key={r}
                onClick={() => handleRemoveRole(r)}
                disabled={isSelf && r === "super_admin"}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-3.5" /> Remove {labelize(r)}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ============================================================
 *  Assign Role Dialog — pick from any user, assign role
 * ============================================================ */
function AssignRoleDialog({ trigger }: { trigger: React.ReactNode }) {
  const { data: allUsers = [], isLoading } = useAllUsers();
  const setRole = useSetUserRole();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [role, setRoleValue] = useState<AppRole>("admin");

  // Protected accounts never appear as assignable targets here.
  const assignableUsers = allUsers.filter((u) => !isProtectedUser(u.email));

  const filtered = assignableUsers.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.full_name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q)
    );
  });

  const handleAssign = async () => {
    if (!selected) {
      toast.error("Please select a user.");
      return;
    }
    try {
      await setRole.mutateAsync({ userId: selected, role });
      const u = assignableUsers.find((x) => x.id === selected);
      toast.success(`${u?.full_name ?? u?.email ?? "User"} is now ${labelize(role)}.`);
      setOpen(false);
      setSelected(null);
      setSearch("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign role.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="size-5 text-primary" /> Assign a Role
          </DialogTitle>
          <DialogDescription>
            Select any registered user and grant them a staff role. Their account will be auto-approved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              className="pl-9"
              placeholder="Search users by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* user list */}
          <div className="max-h-56 overflow-y-auto rounded-xl border border-border/50 divide-y divide-border/30">
            {isLoading ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading users…</p>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No users found.</p>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelected(selected === u.id ? null : u.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary/40 ${
                    selected === u.id ? "bg-primary/10 ring-inset ring-1 ring-primary/30" : ""
                  }`}
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/15 text-[11px] text-primary">
                      {initials(u.full_name ?? u.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.full_name ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex gap-1">
                    {u.roles.map((r) => (
                      <span key={r} className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        {labelize(r)}
                      </span>
                    ))}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* role picker */}
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Role to assign</Label>
            <Select value={role} onValueChange={(v) => setRoleValue(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <span className="flex items-center gap-2">
                    <ShieldHalf className="size-3.5 text-info" /> Admin
                  </span>
                </SelectItem>
                <SelectItem value="super_admin">
                  <span className="flex items-center gap-2">
                    <Crown className="size-3.5 text-amber-400" /> Super Admin
                  </span>
                </SelectItem>
                <SelectItem value="agent">
                  <span className="flex items-center gap-2">
                    <UserCheck className="size-3.5 text-emerald-400" /> Agent
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleAssign} disabled={!selected || setRole.isPending}>
            {setRole.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ShieldCheck className="mr-2 size-4" />}
            Assign Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  Pending Approvals Panel
 * ============================================================ */
function PendingApprovalsPanel() {
  const { data: pending = [], isLoading } = usePendingUsers();
  const approve = useApproveUser();

  if (isLoading) return <LoadingState label="Loading pending users…" />;

  if (pending.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="All caught up"
        subtitle="No users are waiting for approval right now."
      />
    );
  }

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="border-b border-border/40 bg-amber-500/5 px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
          <Clock className="size-4" /> {pending.length} user{pending.length === 1 ? "" : "s"} awaiting approval
        </p>
      </div>
      <div className="divide-y divide-border/30">
        {pending.map((u) => (
          <div key={u.id} className="flex items-center gap-4 px-5 py-3.5">
            <Avatar className="size-10 shrink-0">
              <AvatarFallback className="bg-amber-500/15 text-amber-400 text-sm">
                {initials(u.full_name ?? u.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{u.full_name ?? "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await approve.mutateAsync(u.id);
                  toast.success(`${u.full_name ?? u.email} approved.`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not approve.");
                }
              }}
              disabled={approve.isPending}
            >
              {approve.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              Approve
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
 *  Activity Log Panel
 * ============================================================ */
function ActivityLogPanel({
  activity,
  loading,
}: {
  activity: Array<{
    id: string;
    action: string;
    actor_id: string | null;
    entity_type: string | null;
    entity_id: string | null;
    created_at: string;
    details: unknown;
  }>;
  loading: boolean;
}) {
  if (loading) return <LoadingState label="Loading activity log…" />;

  if (activity.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        subtitle="System events like role changes, approvals, and updates will show up here."
      />
    );
  }

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="border-b border-border/40 bg-secondary/20 px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="size-4 text-primary" /> Recent activity (last 50)
        </p>
      </div>
      <div className="divide-y divide-border/30">
        {activity.map((a) => (
          <div key={a.id} className="flex items-start gap-3 px-5 py-3.5">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="size-3.5 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">{a.action}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {a.entity_type && <span>Entity: <span className="font-mono">{a.entity_type}</span></span>}
                <span>{formatDate(a.created_at)} · {formatTime(a.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
 *  Small UI helpers
 * ============================================================ */

const ROLE_BADGE_CLASS: Record<AppRole, string> = {
  super_admin: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25",
  admin: "bg-info/15 text-info ring-1 ring-info/25",
  agent: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25",
};

const ROLE_AVATAR_COLOR: Record<AppRole, string> = {
  super_admin: "bg-amber-500/20 text-amber-400",
  admin: "bg-info/20 text-info",
  agent: "bg-emerald-500/20 text-emerald-400",
};

const ROLE_DOT_COLOR: Record<AppRole, string> = {
  super_admin: "bg-amber-500",
  admin: "bg-info",
  agent: "bg-emerald-500",
};

const ROLE_ICON: Record<AppRole, typeof Crown | null> = {
  super_admin: Crown,
  admin: ShieldHalf,
  agent: null,
};

function RoleBadge({ role }: { role: AppRole }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_BADGE_CLASS[role]}`}>
      {role === "super_admin" && <Crown className="size-2.5" />}
      {role === "admin" && <ShieldHalf className="size-2.5" />}
      {role === "agent" && <UserCheck className="size-2.5" />}
      {labelize(role)}
    </span>
  );
}

function StatTile({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  tone: "primary" | "info" | "success" | "warning" | "destructive";
}) {
  const toneClass = {
    primary: "from-primary/20 to-primary/5 text-primary ring-primary/25",
    info: "from-info/20 to-info/5 text-info ring-info/25",
    success: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 ring-emerald-500/25",
    warning: "from-amber-500/20 to-amber-500/5 text-amber-400 ring-amber-500/25",
    destructive: "from-red-500/20 to-red-500/5 text-red-400 ring-red-500/25",
  }[tone];

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br ${toneClass} p-4 ring-1`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <Icon className="size-4 opacity-70" />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function RoleHelpCard({
  icon: Icon, tone, title, desc,
}: {
  icon: typeof Crown;
  tone: "warning" | "info" | "success";
  title: string;
  desc: string;
}) {
  const toneClass = {
    warning: "border-amber-500/20 bg-amber-500/5 text-amber-400",
    info: "border-info/20 bg-info/5 text-info",
    success: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
  }[tone];

  return (
    <div className={`rounded-xl border ${toneClass} p-4`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4" />
        <p className="font-semibold text-foreground">{title}</p>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${className}`}>
      {children}
    </th>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="glass flex items-center justify-center gap-2 rounded-2xl py-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

function EmptyState({
  icon: Icon, title, subtitle,
}: {
  icon: typeof Users;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <div className="relative">
        <div className="absolute -inset-3 rounded-full bg-primary/5 blur-xl" />
        <div className="relative flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
          <Icon className="size-7 text-primary/60" />
        </div>
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
