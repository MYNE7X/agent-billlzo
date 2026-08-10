import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { LEAVE_REQUEST_TYPES, ADJUSTMENT_REQUEST_TYPES } from "@/lib/billzo";

export type Agent = Database["public"]["Tables"]["agents"]["Row"];
export type AgentInsert = Database["public"]["Tables"]["agents"]["Insert"];
export type AgentUpdate = Database["public"]["Tables"]["agents"]["Update"];
export type AgentDocument = Database["public"]["Tables"]["agent_documents"]["Row"];
export type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
export type Office = Database["public"]["Tables"]["offices"]["Row"];

export type AgentWithRefs = Agent & {
  departments: { id: string; name: string } | null;
  designations: { id: string; name: string } | null;
  offices: { id: string; office_name: string; office_code: string; location: string | null } | null;
};

// NOTE: We do NOT join offices in AGENT_SELECT because the offices table +
// office_id column may not exist yet (migration pending). Instead, office info
// is fetched separately via useOffices() and merged client-side where needed.
// This makes the app resilient: if the migration hasn't been applied, agents
// still load normally (office_id will be undefined, offices will be null).
const AGENT_SELECT = "*, departments:department_id(id,name), designations:designation_id(id,name)";

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useDesignations() {
  return useQuery({
    queryKey: ["designations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("designations").select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select(AGENT_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AgentWithRefs[];
    },
  });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ["agent", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select(AGENT_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as AgentWithRefs | null;
    },
    enabled: Boolean(id),
  });
}

/** The agent record linked to the signed-in user, if any. */
export function useMyAgent(userId?: string | null) {
  return useQuery({
    queryKey: ["my-agent", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select(AGENT_SELECT)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as AgentWithRefs | null;
    },
    enabled: Boolean(userId),
  });
}

export function useSaveAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: AgentInsert | AgentUpdate }) => {
      if (id) {
        const { data, error } = await supabase
          .from("agents")
          .update(values as AgentUpdate)
          .eq("id", id)
          .select("id")
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("agents")
        .insert(values as AgentInsert)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agents"] });
      void qc.invalidateQueries({ queryKey: ["agent"] });
      void qc.invalidateQueries({ queryKey: ["my-agent"] });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useAgentDocuments(agentId?: string) {
  return useQuery({
    queryKey: ["agent-documents", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_documents")
        .select("*")
        .eq("agent_id", agentId!)
        .order("uploaded_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgentDocument[];
    },
    enabled: Boolean(agentId),
  });
}

export type AttendanceRow = Attendance & {
  agents: {
    id: string;
    full_name: string;
    employee_id: string;
    profile_picture_url: string | null;
    department_id: string | null;
    departments: { name: string } | null;
  } | null;
};

export function useAttendance(date: string) {
  return useQuery({
    queryKey: ["attendance", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select(
          "*, agents:agent_id(id, full_name, employee_id, profile_picture_url, department_id, departments:department_id(name))",
        )
        .eq("date", date)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AttendanceRow[];
    },
  });
}

/** Fetch all attendance records between two dates (inclusive). Used for month view. */
export function useAttendanceRange(from: string, to: string) {
  return useQuery({
    queryKey: ["attendance-range", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select(
          "*, agents:agent_id(id, full_name, employee_id, profile_picture_url, department_id, departments:department_id(name))",
        )
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AttendanceRow[];
    },
    enabled: Boolean(from && to),
  });
}

export function useAgentAttendanceHistory(agentId?: string, limit = 60) {
  return useQuery({
    queryKey: ["attendance-history", agentId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("agent_id", agentId!)
        .order("date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as Attendance[];
    },
    enabled: Boolean(agentId),
  });
}

/**
 * Fetch attendance records for an agent within a specific month.
 * `month` is "YYYY-MM" — we expand to the full month range.
 * Used by the report auto-fill feature.
 */
export function useAgentMonthAttendance(agentId?: string, month?: string) {
  return useQuery({
    queryKey: ["agent-month-attendance", agentId, month],
    queryFn: async () => {
      if (!month) return [];
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y!, m!, 0).getDate(); // days in month
      const from = `${month}-01`;
      const to = `${month}-${String(lastDay).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("agent_id", agentId!)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Attendance[];
    },
    enabled: Boolean(agentId && month),
  });
}

/**
 * Fetch the monthly sales record for an agent in a specific month.
 * Returns the first matching row (or null).
 */
export function useAgentMonthSales(agentId?: string, month?: string) {
  return useQuery({
    queryKey: ["agent-month-sales", agentId, month],
    queryFn: async () => {
      if (!month) return null;
      const monthDate = `${month}-01`;
      const { data, error } = await supabase
        .from("agent_monthly_sales")
        .select("*")
        .eq("agent_id", agentId!)
        .eq("month", monthDate)
        .maybeSingle();
      if (error) throw error;
      return data as MonthlySale | null;
    },
    enabled: Boolean(agentId && month),
  });
}

export function useStaffProfiles() {
  return useQuery({
    queryKey: ["staff-profiles"],
    queryFn: async () => {
      const [{ data: roles, error: rErr }, { data: profiles, error: pErr }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("id, full_name, email, avatar_url"),
      ]);
      if (rErr) throw rErr;
      if (pErr) throw pErr;
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      }));
    },
  });
}

export function logActivity(
  actorId: string | undefined,
  action: string,
  entityType?: string,
  entityId?: string,
) {
  if (!actorId) return;
  void supabase
    .from("activity_logs")
    .insert({
      actor_id: actorId,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
    });
}

/** Fetch a single profile by user ID (for showing linked account info). */
export function useProfile(userId?: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, phone")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(userId),
  });
}

/** All profiles whose user_id is NOT yet linked to any agent (plus optionally the current one). */
export function useUnlinkedProfiles(currentLinkedId?: string | null) {
  return useQuery({
    queryKey: ["unlinked-profiles", currentLinkedId],
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: linked, error: lErr }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("agents").select("user_id").not("user_id", "is", null),
      ]);
      if (pErr) throw pErr;
      if (lErr) throw lErr;
      const linkedIds = new Set((linked ?? []).map((a) => a.user_id).filter(Boolean));
      // include profiles that are not linked, or that are the current one (so we don't hide it)
      return (profiles ?? []).filter((p) => !linkedIds.has(p.id) || p.id === currentLinkedId);
    },
  });
}

/** Fetch all profiles that are not yet approved (pending self-signup approvals). */
export function usePendingUsers() {
  return useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("is_approved", false)
        .order("id");
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        full_name: string | null;
        email: string | null;
        avatar_url: string | null;
      }[];
    },
  });
}

/** Approve a user by setting is_approved = true on their profile. */
export function useApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: true })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pending-users"] });
      void qc.invalidateQueries({ queryKey: ["staff-profiles"] });
    },
  });
}

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

/** Update an existing attendance record (admin adjustment). */
export function useDeleteAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("attendance").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["attendance"] });
      void qc.invalidateQueries({ queryKey: ["attendance-range"] });
      void qc.invalidateQueries({ queryKey: ["attendance-history"] });
    },
  });
}

export function useUpdateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: {
        clock_in?: string | null;
        clock_out?: string | null;
        status?: AttendanceStatus | null;
        notes?: string | null;
      };
    }) => {
      // Recalculate total_hours when both times are provided.
      // If clock_out < clock_in (e.g. 21:00 → 06:00 night shift crossing
      // midnight), assume the clock-out is on the next calendar day and add
      // 24 hours so the result is positive.
      let total_hours: number | null = null;
      if (values.clock_in && values.clock_out) {
        total_hours =
          (new Date(values.clock_out).getTime() - new Date(values.clock_in).getTime()) / 3_600_000;
        if (total_hours < 0) total_hours += 24;
      }
      const { status, notes, clock_in, clock_out } = values;
      const { error } = await supabase
        .from("attendance")
        .update({
          ...(clock_in !== undefined ? { clock_in } : {}),
          ...(clock_out !== undefined ? { clock_out } : {}),
          ...(status != null ? { status } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(total_hours !== null ? { total_hours } : {}),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
}

/** Insert a manual attendance record for any agent (admin-only action). */
export function useInsertAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agent_id,
      date,
      clock_in,
      clock_out,
      status,
      notes,
      created_by,
    }: {
      agent_id: string;
      date: string;
      clock_in?: string | null;
      clock_out?: string | null;
      status?: AttendanceStatus | null;
      notes?: string | null;
      created_by?: string | null;
    }) => {
      let total_hours: number | null = null;
      if (clock_in && clock_out) {
        total_hours = (new Date(clock_out).getTime() - new Date(clock_in).getTime()) / 3_600_000;
        // Night-shift fix: if clock_out < clock_in, assume midnight crossing.
        if (total_hours < 0) total_hours += 24;
      }
      const { error } = await supabase.from("attendance").insert({
        agent_id,
        date,
        ...(clock_in != null ? { clock_in } : {}),
        ...(clock_out != null ? { clock_out } : {}),
        ...(status != null ? { status } : {}),
        ...(notes != null ? { notes } : {}),
        ...(total_hours !== null ? { total_hours } : {}),
        ...(created_by != null ? { created_by } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
}

// ── Monthly Sales ─────────────────────────────────────────────────────────────

export type MonthlySale = Database["public"]["Tables"]["agent_monthly_sales"]["Row"];

export function useAgentMonthlySales(agentId?: string) {
  return useQuery({
    queryKey: ["monthly-sales", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_monthly_sales")
        .select("*")
        .eq("agent_id", agentId!)
        .order("month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MonthlySale[];
    },
    enabled: Boolean(agentId),
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 30_000,
  });
}

export function useUpsertMonthlySale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agentId,
      month,
      amount,
      notes,
      createdBy,
    }: {
      agentId: string;
      month: string; // "YYYY-MM-01"
      amount: number;
      notes?: string;
      createdBy?: string | null;
    }) => {
      const { error } = await supabase
        .from("agent_monthly_sales")
        .upsert(
          {
            agent_id: agentId,
            month,
            amount,
            notes: notes ?? null,
            created_by: createdBy ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "agent_id,month" },
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ["monthly-sales", vars.agentId] });
    },
  });
}

export function useDeleteMonthlySale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, agentId }: { id: string; agentId: string }) => {
      const { error } = await supabase.from("agent_monthly_sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ["monthly-sales", vars.agentId] });
    },
  });
}

// ── Office Expenses ───────────────────────────────────────────────────────────

export type OfficeExpense = Database["public"]["Tables"]["office_expenses"]["Row"];

export function useExpenses(month?: string) {
  return useQuery({
    queryKey: ["expenses", month ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("office_expenses")
        .select("*")
        .order("expense_date", { ascending: false });
      if (month) q = q.eq("month", month);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as OfficeExpense[];
    },
  });
}

export type ExpensePayload = {
  title: string;
  category?: string;
  amount: number;
  expense_date: string;
  month: string;
  description?: string | null;
  paid_to?: string | null;
  payment_method?: string | null;
  receipt_url?: string | null;
  created_by?: string | null;
};

export function useSaveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ExpensePayload }) => {
      if (id) {
        const { error } = await supabase.from("office_expenses").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("office_expenses").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("office_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

// ── Salary Ledger ─────────────────────────────────────────────────────────────

export type SalaryEntry = {
  id: string;
  agent_id: string;
  month: string;
  entry_type: "base_salary" | "deduction" | "bonus";
  amount: number;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function useAgentSalaryLedger(agentId?: string, month?: string) {
  return useQuery({
    queryKey: ["salary-ledger", agentId, month ?? "all"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from("agent_salary_ledger")
        .select("*")
        .eq("agent_id", agentId!);
      if (month) q = q.eq("month", month);
      q = q.order("created_at", { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SalaryEntry[];
    },
    enabled: Boolean(agentId),
  });
}

export function useUpsertSalaryEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      agentId,
      month,
      entry_type,
      amount,
      remarks,
      createdBy,
    }: {
      id?: string;
      agentId: string;
      month: string;
      entry_type: "base_salary" | "deduction" | "bonus";
      amount: number;
      remarks?: string;
      createdBy?: string | null;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = (supabase as any).from("agent_salary_ledger");
      if (id) {
        const { error } = await table
          .update({ amount, remarks: remarks ?? null, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await table.insert({
          agent_id: agentId,
          month,
          entry_type,
          amount,
          remarks: remarks ?? null,
          created_by: createdBy ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ["salary-ledger", vars.agentId] });
    },
  });
}

export function useDeleteSalaryEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, agentId }: { id: string; agentId: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("agent_salary_ledger")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ["salary-ledger", vars.agentId] });
    },
  });
}

// ── Office Network Settings ───────────────────────────────────────────────────

export type NetworkSetting = {
  id: string;
  name: string;
  allowed_ip: string;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceViolation = {
  id: string;
  agent_id: string | null;
  attempted_at: string;
  ip_address: string | null;
  notes: string | null;
  created_at: string;
  agents?: { full_name: string; employee_id: string } | null;
};

export function useNetworkSettings() {
  return useQuery({
    queryKey: ["network-settings"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("office_network_settings")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as NetworkSetting[];
    },
  });
}

export function useSaveNetworkSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      allowed_ip,
      enabled,
      createdBy,
    }: {
      id?: string;
      name: string;
      allowed_ip: string;
      enabled?: boolean;
      createdBy?: string | null;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = (supabase as any).from("office_network_settings");
      if (id) {
        const { error } = await table
          .update({ name, allowed_ip, enabled: enabled ?? true, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await table.insert({ name, allowed_ip, enabled: enabled ?? true, created_by: createdBy ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["network-settings"] }),
  });
}

export function useDeleteNetworkSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("office_network_settings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["network-settings"] }),
  });
}

export function useAttendanceViolations() {
  return useQuery({
    queryKey: ["attendance-violations"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("attendance_violations")
        .select("*, agents:agent_id(full_name, employee_id)")
        .order("attempted_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AttendanceViolation[];
    },
  });
}

export function useLogAttendanceViolation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agentId,
      ipAddress,
      notes,
    }: {
      agentId: string;
      ipAddress: string;
      notes?: string;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("attendance_violations").insert({
        agent_id: agentId,
        ip_address: ipAddress,
        notes: notes ?? null,
      });
      if (error) console.error("Violation log error:", error);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["attendance-violations"] }),
  });
}

/** Link (or unlink) a user account to an agent by setting agents.user_id. */
export function useLinkAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ agentId, userId }: { agentId: string; userId: string | null }) => {
      const { error } = await supabase
        .from("agents")
        .update({ user_id: userId } as AgentUpdate)
        .eq("id", agentId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["agents"] });
      void qc.invalidateQueries({ queryKey: ["agent", vars.agentId] });
      void qc.invalidateQueries({ queryKey: ["my-agent"] });
      void qc.invalidateQueries({ queryKey: ["unlinked-profiles"] });
      void qc.invalidateQueries({ queryKey: ["profile", vars.userId] });
    },
  });
}

// ── Monthly Reports ───────────────────────────────────────────────────────────

export type MonthlyReport = Database["public"]["Tables"]["agent_monthly_reports"]["Row"];

export type MonthlyReportWithAgent = MonthlyReport & {
  agents: {
    id: string;
    full_name: string;
    employee_id: string;
    profile_picture_url: string | null;
    department_id: string | null;
    office_id: string | null;
    departments: { name: string } | null;
    designations: { name: string } | null;
  } | null;
};

const REPORT_SELECT =
  "*, agents:agent_id(id, full_name, employee_id, profile_picture_url, department_id, office_id, departments:department_id(name), designations:designation_id(name))";

/** All monthly reports for a single agent (used by the agent's own Reports page). */
export function useAgentReports(agentId?: string) {
  return useQuery({
    queryKey: ["agent-reports", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_monthly_reports")
        .select(REPORT_SELECT)
        .eq("agent_id", agentId!)
        .order("month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MonthlyReportWithAgent[];
    },
    enabled: Boolean(agentId),
  });
}

/** Cross-agent view used by admins — filterable by month. */
export function useAllReports(month?: string) {
  return useQuery({
    queryKey: ["all-reports", month ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("agent_monthly_reports")
        .select(REPORT_SELECT)
        .order("overall_score", { ascending: false });
      if (month) q = q.eq("month", month);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as MonthlyReportWithAgent[];
    },
  });
}

export type ReportInput = {
  id?: string;
  agent_id: string;
  month: string; // "YYYY-MM-01"
  base_salary?: number;
  bonus?: number;
  deduction?: number;
  total_sales?: number;
  sales_target?: number;
  performance_score?: number;
  behavior_score?: number;
  attendance_score?: number;
  punctuality_score?: number;
  days_present?: number;
  days_absent?: number;
  days_late?: number;
  days_leave?: number;
  total_hours?: number;
  headline?: string | null;
  notes?: string | null;
  sentiment?: "praise" | "improvement" | "warning" | "neutral";
  created_by?: string | null;
};

export function useUpsertReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReportInput) => {
      const { id, created_by, ...rest } = input;
      const payload = {
        ...rest,
        ...(created_by != null ? { created_by } : {}),
        updated_at: new Date().toISOString(),
      };
      if (id) {
        const { error } = await supabase
          .from("agent_monthly_reports")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("agent_monthly_reports")
          .upsert(payload, { onConflict: "agent_id,month" });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ["agent-reports", vars.agent_id] });
      void qc.invalidateQueries({ queryKey: ["all-reports"] });
    },
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, agentId }: { id: string; agentId: string }) => {
      const { error } = await supabase
        .from("agent_monthly_reports")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ["agent-reports", vars.agentId] });
      void qc.invalidateQueries({ queryKey: ["all-reports"] });
    },
  });
}

// ============================================================================
// OFFICES — CRUD + agent-count
// ============================================================================

export function useOffices(statusFilter?: "active" | "inactive") {
  return useQuery({
    queryKey: ["offices", statusFilter ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("offices")
        .select("*")
        .order("office_name", { ascending: true });
      if (statusFilter) q = q.eq("status", statusFilter);
      const { data, error } = await q;
      // If the offices table doesn't exist yet (migration pending),
      // return an empty array instead of throwing — the app still works.
      if (error) {
        // PGRST205 = "no matching relationship found" (table/column missing)
        // 42P01 = "relation does not exist"
        if (error.code === "PGRST205" || error.code === "42P01" || error.message.includes("does not exist")) {
          return [] as Office[];
        }
        throw error;
      }
      return (data ?? []) as Office[];
    },
    // Don't retry on schema errors — just return empty
    retry: (failureCount, error) => {
      if (error && (error.code === "PGRST205" || error.code === "42P01")) return false;
      return failureCount < 2;
    },
  });
}

/** Offices + agent count per office (single RPC-free query). */
export function useOfficesWithCounts(statusFilter?: "active" | "inactive") {
  return useQuery({
    queryKey: ["offices-with-counts", statusFilter ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("offices")
        .select("*, agents!office_id(id)")
        .order("office_name", { ascending: true });
      if (statusFilter) q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) {
        if (error.code === "PGRST205" || error.code === "42P01" || error.message.includes("does not exist")) {
          return [] as (Office & { agent_count: number })[];
        }
        throw error;
      }
      return (data ?? []).map((o) => {
        const agents = (o as unknown as { agents?: unknown[] }).agents;
        return {
          ...o,
          agent_count: Array.isArray(agents) ? agents.length : 0,
        };
      }) as (Office & { agent_count: number })[];
    },
    retry: (failureCount, error) => {
      if (error && (error.code === "PGRST205" || error.code === "42P01")) return false;
      return failureCount < 2;
    },
  });
}

export function useUpsertOffice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      office_name: string;
      office_code: string;
      location?: string | null;
      description?: string | null;
      status?: string;
      created_by?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("offices")
        .upsert({
          id: input.id,
          office_name: input.office_name,
          office_code: input.office_code,
          location: input.location ?? null,
          description: input.description ?? null,
          status: input.status ?? "active",
          created_by: input.created_by ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Office;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["offices"] });
      void qc.invalidateQueries({ queryKey: ["offices-with-counts"] });
      void qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useDeleteOffice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("offices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["offices"] });
      void qc.invalidateQueries({ queryKey: ["offices-with-counts"] });
      void qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

/** Toggle an office between active / inactive. */
export function useToggleOfficeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "inactive" }) => {
      const { data, error } = await supabase
        .from("offices")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Office;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["offices"] });
      void qc.invalidateQueries({ queryKey: ["offices-with-counts"] });
    },
  });
}

/** Assign an office to an agent (admin/super_admin only). */
export function useAssignAgentOffice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ agentId, officeId }: { agentId: string; officeId: string | null }) => {
      const { data, error } = await supabase
        .from("agents")
        .update({ office_id: officeId })
        .eq("id", agentId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agents"] });
      void qc.invalidateQueries({ queryKey: ["offices-with-counts"] });
    },
  });
}

/** Toggle the employee_id_locked flag (super_admin only). */
export function useToggleEmployeeIdLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ agentId, locked }: { agentId: string; locked: boolean }) => {
      const { data, error } = await supabase
        .from("agents")
        .update({ employee_id_locked: locked })
        .eq("id", agentId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

/**
 * Helper hook: returns a Map of office_id → office object.
 * Use this to look up an agent's office from their office_id field.
 * Returns an empty Map if the offices table doesn't exist yet (migration pending).
 */
export function useOfficesMap() {
  const { data: offices = [] } = useOffices("active");
  const map = useMemo(() => {
    const m = new Map<string, Office>();
    for (const o of offices) m.set(o.id, o);
    return m;
  }, [offices]);
  return map;
}

// ============================================================================
// ATTENDANCE REQUESTS
// ============================================================================

export type AttendanceRequest = Database["public"]["Tables"]["attendance_requests"]["Row"];

export type AttendanceRequestWithAgent = AttendanceRequest & {
  agents: {
    id: string;
    full_name: string;
    employee_id: string;
    profile_picture_url: string | null;
    office_id: string | null;
    departments: { name: string } | null;
  } | null;
};

const REQUEST_SELECT = "*, agents:agent_id(id, full_name, employee_id, profile_picture_url, office_id, departments:department_id(name))";

/** All requests — staff only. Optional status filter. */
export function useAttendanceRequests(statusFilter?: string) {
  return useQuery({
    queryKey: ["attendance-requests", statusFilter ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("attendance_requests")
        .select(REQUEST_SELECT)
        .order("created_at", { ascending: false });
      if (statusFilter && statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) {
        // Resilient: if table doesn't exist yet (migration pending), return []
        if (error.code === "PGRST205" || error.code === "42P01") return [];
        throw error;
      }
      return (data ?? []) as unknown as AttendanceRequestWithAgent[];
    },
    retry: (failureCount, error) => {
      if (error && (error.code === "PGRST205" || error.code === "42P01")) return false;
      return failureCount < 2;
    },
  });
}

/** Count of pending requests — for dashboard card. Staff only. */
export function usePendingRequestCount() {
  return useQuery({
    queryKey: ["attendance-requests-pending-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("attendance_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) {
        if (error.code === "PGRST205" || error.code === "42P01") return 0;
        throw error;
      }
      return count ?? 0;
    },
    retry: (failureCount, error) => {
      if (error && (error.code === "PGRST205" || error.code === "42P01")) return false;
      return failureCount < 2;
    },
    staleTime: 15_000,
  });
}

// ============================================================================
// EDIT HISTORY + REVIEWER NAME LOOKUP
// ============================================================================

export type EditHistoryEntry = Database["public"]["Tables"]["edit_history"]["Row"];

export type UserInfo = {
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

/** Resolve a user's display name + email via the get_user_display_name RPC. */
export async function fetchUserInfo(userId: string): Promise<UserInfo | null> {
  const { data, error } = await supabase.rpc("get_user_display_name", { _user_id: userId });
  if (error) {
    // If the function doesn't exist yet (migration pending), return null
    if (error.code === "PGRST205" || error.code === "42883") return null;
    return null;
  }
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row as unknown as UserInfo;
}

/** Fetch edit history for an entity (e.g. agent_profile). */
export function useEditHistory(entityType: string, entityId?: string) {
  return useQuery({
    queryKey: ["edit-history", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("edit_history")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId!)
        .order("edited_at", { ascending: false })
        .limit(20);
      if (error) {
        if (error.code === "PGRST205" || error.code === "42P01") return [];
        throw error;
      }
      return (data ?? []) as EditHistoryEntry[];
    },
    enabled: Boolean(entityId),
    retry: (failureCount, error) => {
      if (error && (error.code === "PGRST205" || error.code === "42P01")) return false;
      return failureCount < 2;
    },
  });
}

/** Write an edit history entry (fire-and-forget). */
export function logEdit(input: {
  entityType: string;
  entityId: string;
  section?: string;
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
  editedBy?: string | null;
}) {
  void supabase.from("edit_history").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    section: input.section ?? null,
    field_name: input.fieldName ?? null,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    edited_by: input.editedBy ?? null,
  });
}

/** Requests for a specific agent (agent's own view). */
export function useAgentAttendanceRequests(agentId?: string) {
  return useQuery({
    queryKey: ["agent-attendance-requests", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_requests")
        .select("*")
        .eq("agent_id", agentId!)
        .order("created_at", { ascending: false });
      if (error) {
        if (error.code === "PGRST205" || error.code === "42P01") return [];
        throw error;
      }
      return (data ?? []) as AttendanceRequest[];
    },
    enabled: Boolean(agentId),
    retry: (failureCount, error) => {
      if (error && (error.code === "PGRST205" || error.code === "42P01")) return false;
      return failureCount < 2;
    },
  });
}

/** Create a new request (agent). */
export function useCreateAttendanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      agent_id: string;
      request_type: string;
      attendance_date?: string | null;
      from_date?: string | null;
      to_date?: string | null;
      reason: string;
      details?: string | null;
      attachment_url?: string | null;
      requested_clock_in?: string | null;
      requested_clock_out?: string | null;
      requested_status?: string | null;
      created_by?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("attendance_requests")
        .insert({
          agent_id: input.agent_id,
          request_type: input.request_type,
          attendance_date: input.attendance_date ?? null,
          from_date: input.from_date ?? null,
          to_date: input.to_date ?? null,
          reason: input.reason,
          details: input.details ?? null,
          attachment_url: input.attachment_url ?? null,
          requested_clock_in: input.requested_clock_in ?? null,
          requested_clock_out: input.requested_clock_out ?? null,
          requested_status: input.requested_status ?? null,
          created_by: input.created_by ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as AttendanceRequest;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agent-attendance-requests"] });
      void qc.invalidateQueries({ queryKey: ["attendance-requests"] });
      void qc.invalidateQueries({ queryKey: ["attendance-requests-pending-count"] });
    },
  });
}

/** Update own pending request (agent can edit or cancel). */
export function useUpdateAttendanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      request_type?: string;
      attendance_date?: string | null;
      from_date?: string | null;
      to_date?: string | null;
      reason?: string;
      details?: string | null;
      requested_clock_in?: string | null;
      requested_clock_out?: string | null;
      requested_status?: string | null;
      status?: string; // agent can set to 'cancelled'
    }) => {
      const { data, error } = await supabase
        .from("attendance_requests")
        .update({
          request_type: input.request_type,
          attendance_date: input.attendance_date,
          from_date: input.from_date,
          to_date: input.to_date,
          reason: input.reason,
          details: input.details,
          requested_clock_in: input.requested_clock_in,
          requested_clock_out: input.requested_clock_out,
          requested_status: input.requested_status,
          status: input.status,
        })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as AttendanceRequest;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agent-attendance-requests"] });
      void qc.invalidateQueries({ queryKey: ["attendance-requests"] });
      void qc.invalidateQueries({ queryKey: ["attendance-requests-pending-count"] });
    },
  });
}

/**
 * Approve/reject a request (staff only).
 * When approving an adjustment-type request, also updates the attendance record
 * + writes an audit row.
 */
export function useReviewAttendanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      request: AttendanceRequestWithAgent;
      decision: "approved" | "rejected";
      admin_note?: string;
      rejection_reason?: string;
      reviewer_id: string;
    }) => {
      const { request, decision, admin_note, rejection_reason, reviewer_id } = input;

      // 1. Update the request
      const { data: updated, error: updateErr } = await supabase
        .from("attendance_requests")
        .update({
          status: decision,
          admin_note: admin_note ?? null,
          rejection_reason: decision === "rejected" ? (rejection_reason ?? null) : null,
          reviewed_by: reviewer_id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request.id)
        .select()
        .single();
      if (updateErr) throw updateErr;

      // 2. If approved + adjustment type → update attendance + audit
      if (decision === "approved" && request.agents) {
        await applyAttendanceAdjustment(request, reviewer_id);
      }

      return updated;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["attendance-requests"] });
      void qc.invalidateQueries({ queryKey: ["agent-attendance-requests"] });
      void qc.invalidateQueries({ queryKey: ["attendance-requests-pending-count"] });
      void qc.invalidateQueries({ queryKey: ["attendance"] });
      void qc.invalidateQueries({ queryKey: ["attendance-history"] });
    },
  });
}

/**
 * Helper: when a request is approved, update the attendance record + audit.
 * - Leave-type → set status to 'leave' for the date range
 * - Missing check-in/out → set the requested clock_in/out
 * - Adjustment → set requested clock_in/out/status
 */
async function applyAttendanceAdjustment(
  request: AttendanceRequestWithAgent,
  reviewerId: string,
) {
  const agentId = request.agent_id;
  const isLeave = LEAVE_REQUEST_TYPES.has(request.request_type);
  const isAdjustment = ADJUSTMENT_REQUEST_TYPES.has(request.request_type);

  if (!isLeave && !isAdjustment) return;

  // Build the list of dates to update
  const dates: string[] = [];
  if (request.from_date && request.to_date) {
    // Multi-day leave
    const start = new Date(request.from_date);
    const end = new Date(request.to_date);
    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
  } else if (request.attendance_date) {
    dates.push(request.attendance_date);
  }

  for (const dateStr of dates) {
    // Fetch existing attendance record (if any)
    const { data: existing } = await supabase
      .from("attendance")
      .select("*")
      .eq("agent_id", agentId)
      .eq("date", dateStr)
      .maybeSingle();

    const oldRecord = existing as {
      id: string;
      clock_in: string | null;
      clock_out: string | null;
      total_hours: number | null;
      status: string;
    } | null;

    // Build the new values
    let newClockIn = oldRecord?.clock_in ?? null;
    let newClockOut = oldRecord?.clock_out ?? null;
    let newStatus = oldRecord?.status ?? "present";

    if (isLeave) {
      newStatus = "leave";
    } else {
      // Adjustment types
      if (request.requested_clock_in) newClockIn = request.requested_clock_in;
      if (request.requested_clock_out) newClockOut = request.requested_clock_out;
      if (request.requested_status) newStatus = request.requested_status;
    }

    // Upsert the attendance record
    const { data: upserted, error: upsertErr } = await supabase
      .from("attendance")
      .upsert({
        id: oldRecord?.id,
        agent_id: agentId,
        date: dateStr,
        clock_in: newClockIn,
        clock_out: newClockOut,
        status: newStatus as "present" | "absent" | "late" | "half_day" | "leave" | "holiday" | "weekly_off",
        created_by: reviewerId,
      })
      .select()
      .single();

    if (upsertErr) {
      console.error("[applyAttendanceAdjustment] upsert error:", upsertErr);
      continue;
    }

    // Write audit row
    await supabase.from("attendance_adjustment_audit").insert({
      request_id: request.id,
      attendance_id: upserted?.id ?? null,
      agent_id: agentId,
      original_clock_in: oldRecord?.clock_in ?? null,
      original_clock_out: oldRecord?.clock_out ?? null,
      original_total_hours: oldRecord?.total_hours ?? null,
      original_status: oldRecord?.status ?? null,
      new_clock_in: newClockIn,
      new_clock_out: newClockOut,
      new_total_hours: upserted?.total_hours ?? null,
      new_status: newStatus,
      approved_by: reviewerId,
    });
  }
}
