/**
 * Admin & Role management hooks.
 *
 * Used by the /admins route (Super Admin only).
 *
 * All mutations go through SECURITY DEFINER SQL functions (see
 * supabase/migrations/20260803_admins_roles.sql) so the RLS on
 * user_roles can stay locked down to SELECT-only for authenticated
 * users — only super_admins can call these RPCs.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";

/* ──────────────────────────────────────────────────────────
 *  Types
 * ────────────────────────────────────────────────────────── */

export type AdminUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_approved: boolean;
  must_change_password: boolean;
  roles: AppRole[];
};

/* ──────────────────────────────────────────────────────────
 *  useAllUsers — every profile with their roles + flags
 *  Super-admin-only by RLS (staff_can_update_any_profile +
 *  roles read policies already permit this).
 * ────────────────────────────────────────────────────────── */
export function useAllUsers() {
  return useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url, phone, is_approved, must_change_password")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;

      const roleMap = new Map<string, AppRole[]>();
      for (const r of roles ?? []) {
        const list = roleMap.get(r.user_id) ?? [];
        list.push(r.role as AppRole);
        roleMap.set(r.user_id, list);
      }

      return (profiles ?? []).map((p) => ({
        ...p,
        roles: roleMap.get(p.id) ?? [],
      })) as AdminUser[];
    },
  });
}

/* ──────────────────────────────────────────────────────────
 *  useSetUserRole — RPC: set_user_role(user_id, role)
 *  Idempotent: inserts the role if not present.
 *  Auto-approves the user if role is admin or super_admin
 *  (handled by the existing trg_auto_approve_on_role trigger).
 * ────────────────────────────────────────────────────────── */
export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.rpc("set_user_role", {
        p_user_id: userId,
        p_role: role,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ["staff-profiles"] });
      void qc.invalidateQueries({ queryKey: ["all-users"] });
      void qc.invalidateQueries({ queryKey: ["pending-users"] });
      void qc.invalidateQueries({ queryKey: ["unlinked-profiles"] });
      // Also invalidate the agent-link query if relevant
      void qc.invalidateQueries({ queryKey: ["profile", vars.userId] });
    },
  });
}

/* ──────────────────────────────────────────────────────────
 *  useRemoveUserRole — RPC: remove_user_role(user_id, role)
 *  Removes a single role from a user. Does NOT unapprove them.
 * ────────────────────────────────────────────────────────── */
export function useRemoveUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.rpc("remove_user_role", {
        p_user_id: userId,
        p_role: role,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ["staff-profiles"] });
      void qc.invalidateQueries({ queryKey: ["all-users"] });
      void qc.invalidateQueries({ queryKey: ["profile", vars.userId] });
    },
  });
}

/* ──────────────────────────────────────────────────────────
 *  useForcePasswordChange — set profiles.must_change_password = true
 *  Existing trigger allows any staff (admin/super_admin) to set
 *  this flag on any profile row.
 * ────────────────────────────────────────────────────────── */
export function useForcePasswordChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["all-users"] });
      void qc.invalidateQueries({ queryKey: ["staff-profiles"] });
    },
  });
}

/* ──────────────────────────────────────────────────────────
 *  useSendPasswordReset — Supabase Auth reset email
 *  Uses the standard password-reset flow; the email contains
 *  a link that lands on / and lets the user set a new password.
 * ────────────────────────────────────────────────────────── */
export function useSendPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
    },
  });
}

/* ──────────────────────────────────────────────────────────
 *  useActivityLogs — recent system activity
 *  RLS already permits staff (admin/super_admin) to SELECT.
 * ────────────────────────────────────────────────────────── */
export function useActivityLogs(limit = 50) {
  return useQuery({
    queryKey: ["activity-logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, action, actor_id, entity_type, entity_id, details, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        action: string;
        actor_id: string | null;
        entity_type: string | null;
        entity_id: string | null;
        details: unknown;
        created_at: string;
      }>;
    },
  });
}

/* ──────────────────────────────────────────────────────────
 *  logAdminAction — convenience wrapper for activity_logs
 *  Use to record role/password/approval actions performed by
 *  super_admins. Fires-and-forgets.
 * ────────────────────────────────────────────────────────── */
export function logAdminAction(
  actorId: string | undefined,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>,
) {
  if (!actorId) return;
  void supabase.from("activity_logs").insert({
    actor_id: actorId,
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    details: details ?? null,
  });
}
