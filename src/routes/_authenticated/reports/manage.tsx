import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  Search,
  Trophy,
  TrendingUp,
  Banknote,
  Target,
  Award,
  Smile,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Info,
  X,
  Filter,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useAuth } from "@/hooks/useAuth";
import {
  useAgents,
  useAllReports,
  useUpsertReport,
  useDeleteReport,
  useAgentMonthAttendance,
  useAgentMonthSales,
  useAgentSalaryLedger,
  type MonthlyReportWithAgent,
  type ReportInput,
  type AgentWithRefs,
} from "@/lib/queries";
import { formatPKR, formatDate, initials } from "@/lib/billzo";
import { SecureImage } from "@/components/billzo/SecureImage";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/reports/manage")({
  component: ManageReportsPage,
});

const SENTIMENTS = [
  { value: "praise", label: "Praise", icon: Trophy, color: "text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30" },
  { value: "improvement", label: "Improvement", icon: Sparkles, color: "text-blue-400", bg: "bg-blue-500/10", ring: "ring-blue-500/30" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/30" },
  { value: "neutral", label: "Neutral", icon: Info, color: "text-muted-foreground", bg: "bg-secondary/40", ring: "ring-border/40" },
] as const;

const scoreTone = (s: number) =>
  s >= 85 ? "text-emerald-400" : s >= 70 ? "text-blue-400" : s >= 50 ? "text-amber-400" : "text-red-400";

// ── form schema ────────────────────────────────────────────────────────────

const reportSchema = z.object({
  agent_id: z.string().min(1, "Select an agent"),
  month: z.string().min(7, "Pick a month"), // YYYY-MM
  base_salary: z.coerce.number().min(0).default(0),
  bonus: z.coerce.number().min(0).default(0),
  deduction: z.coerce.number().min(0).default(0),
  total_sales: z.coerce.number().min(0).default(0),
  sales_target: z.coerce.number().min(0).default(0),
  performance_score: z.coerce.number().min(0).max(100).default(0),
  behavior_score: z.coerce.number().min(0).max(100).default(0),
  attendance_score: z.coerce.number().min(0).max(100).default(0),
  punctuality_score: z.coerce.number().min(0).max(100).default(0),
  days_present: z.coerce.number().int().min(0).default(0),
  days_absent: z.coerce.number().int().min(0).default(0),
  days_late: z.coerce.number().int().min(0).default(0),
  days_leave: z.coerce.number().int().min(0).default(0),
  total_hours: z.coerce.number().min(0).default(0),
  headline: z.string().max(120).optional(),
  notes: z.string().optional(),
  sentiment: z.enum(["praise", "improvement", "warning", "neutral"]).default("neutral"),
});

type ReportForm = z.infer<typeof reportSchema>;

function toMonthInput(d: Date) {
  // YYYY-MM
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthDate(monthInput: string) {
  // YYYY-MM → YYYY-MM-01 (the date stored in DB)
  return `${monthInput}-01`;
}

// ── main page ──────────────────────────────────────────────────────────────

function ManageReportsPage() {
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();
  const { data: agents = [] } = useAgents();
  const { data: reports = [], isLoading } = useAllReports();
  const upsert = useUpsertReport();
  const del = useDeleteReport();

  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [editing, setEditing] = useState<MonthlyReportWithAgent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MonthlyReportWithAgent | null>(null);

  useEffect(() => {
    if (!isStaff) {
      void navigate({ to: "/reports" });
    }
  }, [isStaff, navigate]);

  // Build month options from reports + current month
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => set.add(r.month));
    set.add(toMonthDate(toMonthInput(new Date())));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [reports]);

  const filtered = useMemo(() => {
    let r = reports;
    if (monthFilter !== "all") r = r.filter((x) => x.month === monthFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (x) =>
          x.agents?.full_name?.toLowerCase().includes(q) ||
          x.agents?.employee_id?.toLowerCase().includes(q) ||
          x.headline?.toLowerCase().includes(q),
      );
    }
    return r;
  }, [reports, search, monthFilter]);

  // Aggregate summary
  const agg = useMemo(() => {
    if (!filtered.length) return { count: 0, avgScore: 0, totalSales: 0, totalNet: 0 };
    return {
      count: filtered.length,
      avgScore: filtered.reduce((s, r) => s + r.overall_score, 0) / filtered.length,
      totalSales: filtered.reduce((s, r) => s + Number(r.total_sales), 0),
      totalNet: filtered.reduce((s, r) => s + Number(r.net_salary), 0),
    };
  }, [filtered]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(r: MonthlyReportWithAgent) {
    setEditing(r);
    setDialogOpen(true);
  }

  async function handleSubmit(values: ReportForm) {
    const payload: ReportInput = {
      id: editing?.id,
      agent_id: values.agent_id,
      month: toMonthDate(values.month),
      base_salary: values.base_salary,
      bonus: values.bonus,
      deduction: values.deduction,
      total_sales: values.total_sales,
      sales_target: values.sales_target,
      performance_score: values.performance_score,
      behavior_score: values.behavior_score,
      attendance_score: values.attendance_score,
      punctuality_score: values.punctuality_score,
      days_present: values.days_present,
      days_absent: values.days_absent,
      days_late: values.days_late,
      days_leave: values.days_leave,
      total_hours: values.total_hours,
      headline: values.headline || null,
      notes: values.notes || null,
      sentiment: values.sentiment,
      created_by: editing?.created_by ?? user?.id ?? null,
    };
    try {
      await upsert.mutateAsync(payload);
      toast.success(editing ? "Report updated" : "Report created");
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save report");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await del.mutateAsync({ id: pendingDelete.id, agentId: pendingDelete.agent_id });
      toast.success("Report deleted");
      setPendingDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  if (!isStaff) return null;

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br from-[#0d1420] via-[#0f1827] to-[#090e18] p-6 sm:p-8 shadow-2xl shadow-black/40 animate-rise">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 size-72 rounded-full bg-primary/8 blur-3xl" />
          <div className="absolute -bottom-10 left-1/3 size-56 rounded-full bg-indigo-500/6 blur-3xl" />
        </div>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
              <BarChart3 className="size-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-gradient sm:text-3xl">
                Manage Reports
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground/70">
                Create and edit monthly performance reports for agents.
              </p>
            </div>
          </div>
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="size-4" /> New Report
          </Button>
        </div>
      </div>

      {/* summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Reports" value={String(agg.count)} icon={BarChart3} color="text-primary" bg="bg-primary/10" ring="ring-primary/20" />
        <Stat label="Avg Score" value={agg.avgScore.toFixed(0)} icon={Trophy} color="text-emerald-400" bg="bg-emerald-500/10" ring="ring-emerald-500/20" suffix="/100" />
        <Stat label="Total Sales" value={formatPKR(agg.totalSales)} icon={TrendingUp} color="text-info" bg="bg-info/10" ring="ring-info/20" compact />
        <Stat label="Total Net" value={formatPKR(agg.totalNet)} icon={Banknote} color="text-amber-400" bg="bg-amber-500/10" ring="ring-amber-500/20" compact />
      </div>

      {/* filters */}
      <div className="glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Search agent name, ID, or headline..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground/60" />
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {monthOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {new Date(m).toLocaleDateString("en-PK", { year: "numeric", month: "long" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* list */}
      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !filtered.length ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-secondary/40 ring-1 ring-border">
            <BarChart3 className="size-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No reports found</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {reports.length === 0
              ? "Create your first monthly report to get started."
              : "Try adjusting your search or filter."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <ReportRowCard
              key={r.id}
              report={r}
              onEdit={() => openEdit(r)}
              onDelete={() => setPendingDelete(r)}
            />
          ))}
        </div>
      )}

      {/* editor dialog */}
      <ReportDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        agents={agents.map((a) => ({
          id: a.id,
          full_name: a.full_name,
          employee_id: a.employee_id,
          profile_picture_url: a.profile_picture_url,
          salary: a.salary,
          shift_timing: a.shift_timing,
        }))}
        onSubmit={handleSubmit}
        saving={upsert.isPending}
      />

      {/* delete confirm */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the report for{" "}
              <span className="font-semibold text-foreground">
                {pendingDelete?.agents?.full_name ?? "this agent"}
              </span>{" "}
              for{" "}
              <span className="font-semibold text-foreground">
                {pendingDelete ? new Date(pendingDelete.month).toLocaleDateString("en-PK", { year: "numeric", month: "long" }) : ""}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── row card ──────────────────────────────────────────────────────────────

function ReportRowCard({
  report,
  onEdit,
  onDelete,
}: {
  report: MonthlyReportWithAgent;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const sentiment = SENTIMENTS.find((s) => s.value === report.sentiment) ?? SENTIMENTS[3]!;
  const SentimentIcon = sentiment.icon;

  return (
    <div className="glass group relative flex flex-col gap-3 rounded-2xl p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      {/* top row: agent */}
      <div className="flex items-start gap-3">
        <div className="size-10 overflow-hidden rounded-xl ring-1 ring-border/40">
          {report.agents?.profile_picture_url ? (
            <SecureImage path={report.agents.profile_picture_url} alt={report.agents.full_name} className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center bg-primary/15 text-xs font-bold text-primary">
              {initials(report.agents?.full_name)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{report.agents?.full_name ?? "—"}</p>
          <p className="truncate text-[11px] text-muted-foreground/70">
            {report.agents?.employee_id} · {new Date(report.month).toLocaleDateString("en-PK", { year: "numeric", month: "short" })}
          </p>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full border border-current/30 px-2 py-0.5 text-[10px] font-medium", sentiment.color, sentiment.bg)}>
          <SentimentIcon className="size-3" /> {sentiment.label}
        </span>
      </div>

      {/* scores row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Perf", value: report.performance_score, icon: Award },
          { label: "Behav", value: report.behavior_score, icon: Smile },
          { label: "Attd", value: report.attendance_score, icon: CheckCircle2 },
          { label: "Punc", value: report.punctuality_score, icon: Clock },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-secondary/30 px-2 py-1.5 text-center">
            <s.icon className={cn("mx-auto size-3", scoreTone(s.value))} />
            <p className={cn("mt-0.5 font-mono text-xs font-bold tabular-nums", scoreTone(s.value))}>
              {s.value.toFixed(0)}
            </p>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">{s.label}</p>
          </div>
        ))}
      </div>

      {/* overall + salary */}
      <div className="flex items-center justify-between rounded-xl bg-primary/5 px-3 py-2 ring-1 ring-primary/15">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Overall</p>
          <p className={cn("font-mono text-lg font-bold tabular-nums", scoreTone(report.overall_score))}>
            {report.overall_score.toFixed(0)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Net Salary</p>
          <p className="font-mono text-sm font-bold text-primary">{formatPKR(report.net_salary)}</p>
        </div>
      </div>

      {/* sales */}
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground/70">
          <Target className="size-3" /> Sales
        </span>
        <span className="font-mono font-semibold tabular-nums text-info">
          {formatPKR(report.total_sales)} / {formatPKR(report.sales_target)}
        </span>
      </div>

      {/* actions */}
      <div className="flex items-center gap-2 border-t border-border/30 pt-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onEdit}>
          <Pencil className="size-3" /> Edit
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}>
          <Trash2 className="size-3" />
        </Button>
      </div>

      {/* footer */}
      <p className="text-[10px] text-muted-foreground/50">
        Updated {formatDate(report.updated_at)}
      </p>
    </div>
  );
}

// ── dialog (create / edit) ─────────────────────────────────────────────────

function ReportDialog({
  open,
  onOpenChange,
  editing,
  agents,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: MonthlyReportWithAgent | null;
  agents: {
    id: string;
    full_name: string;
    employee_id: string;
    profile_picture_url: string | null;
    salary: number | null;
    shift_timing: string | null;
  }[];
  onSubmit: (v: ReportForm) => void | Promise<void>;
  saving: boolean;
}) {
  const defaults: ReportForm = {
    agent_id: editing?.agent_id ?? "",
    month: editing ? editing.month.slice(0, 7) : toMonthInput(new Date()),
    base_salary: editing?.base_salary ?? 0,
    bonus: editing?.bonus ?? 0,
    deduction: editing?.deduction ?? 0,
    total_sales: editing?.total_sales ?? 0,
    sales_target: editing?.sales_target ?? 0,
    performance_score: editing?.performance_score ?? 0,
    behavior_score: editing?.behavior_score ?? 0,
    attendance_score: editing?.attendance_score ?? 0,
    punctuality_score: editing?.punctuality_score ?? 0,
    days_present: editing?.days_present ?? 0,
    days_absent: editing?.days_absent ?? 0,
    days_late: editing?.days_late ?? 0,
    days_leave: editing?.days_leave ?? 0,
    total_hours: editing?.total_hours ?? 0,
    headline: editing?.headline ?? "",
    notes: editing?.notes ?? "",
    sentiment: editing?.sentiment ?? "neutral",
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<ReportForm>({
    resolver: zodResolver(reportSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const sentiment = watch("sentiment");
  const agentId = watch("agent_id");
  const monthValue = watch("month");
  const selAgent = agents.find((a) => a.id === agentId);

  // ── AUTO-FILL data sources (only when creating, not editing) ───────────────
  // We fetch the agent's existing monthly sales + attendance records for the
  // selected month so the form can pre-fill itself.
  const isCreating = !editing;
  const { data: monthAttendance = [], isLoading: attLoading } = useAgentMonthAttendance(
    isCreating ? agentId : undefined,
    isCreating ? monthValue : undefined,
  );
  const { data: monthSales, isLoading: salesLoading } = useAgentMonthSales(
    isCreating ? agentId : undefined,
    isCreating ? monthValue : undefined,
  );
  // Salary ledger (bonus + deductions) for the month
  const { data: ledgerEntries = [], isLoading: ledgerLoading } = useAgentSalaryLedger(
    isCreating ? agentId : undefined,
    isCreating && monthValue ? `${monthValue}-01` : undefined,
  );

  const autoFillLoading = attLoading || salesLoading || ledgerLoading;

  // ── AUTO-FILL effect: when agent + month change (and we're creating), prefill
  // the salary / sales / attendance / hours fields from existing data.
  // We only run this once per (agentId, monthValue) combination so the admin's
  // manual edits aren't overwritten if they tab back to a field.
  const [autoFilledKey, setAutoFilledKey] = useState<string | null>(null);
  useEffect(() => {
    if (!isCreating || !open) return;
    if (!agentId || !monthValue) return;
    if (autoFillLoading) return;
    const key = `${agentId}|${monthValue}`;
    if (key === autoFilledKey) return; // already filled for this combo

    // Pre-fill base salary from the agent record
    if (selAgent?.salary != null) {
      setValue("base_salary", Number(selAgent.salary), { shouldValidate: true });
    }

    // Pre-fill sales from agent_monthly_sales (if a row exists for this month)
    if (monthSales) {
      setValue("total_sales", Number(monthSales.amount), { shouldValidate: true });
      if (monthSales.notes) {
        setValue("headline", monthSales.notes.slice(0, 120), { shouldValidate: true });
      }
    } else {
      setValue("total_sales", 0, { shouldValidate: true });
    }

    // Pre-fill attendance summary from the fetched attendance records
    const daysPresent = monthAttendance.filter((r) => r.status === "present").length;
    const daysAbsent = monthAttendance.filter((r) => r.status === "absent").length;
    const daysLate = monthAttendance.filter((r) => r.status === "late").length;
    const daysLeave = monthAttendance.filter((r) => r.status === "leave").length;
    const totalHours = monthAttendance.reduce((s, r) => s + (r.total_hours ?? 0), 0);

    setValue("days_present", daysPresent, { shouldValidate: true });
    setValue("days_absent", daysAbsent, { shouldValidate: true });
    setValue("days_late", daysLate, { shouldValidate: true });
    setValue("days_leave", daysLeave, { shouldValidate: true });
    setValue("total_hours", Number(totalHours.toFixed(2)), { shouldValidate: true });

    // Pre-fill bonus + deductions from the salary ledger
    const bonusSum = ledgerEntries
      .filter((e) => e.entry_type === "bonus")
      .reduce((s, e) => s + Number(e.amount), 0);
    const deductionSum = ledgerEntries
      .filter((e) => e.entry_type === "deduction")
      .reduce((s, e) => s + Number(e.amount), 0);
    setValue("bonus", Number(bonusSum.toFixed(2)), { shouldValidate: true });
    setValue("deduction", Number(deductionSum.toFixed(2)), { shouldValidate: true });

    // Auto-set sentiment based on attendance ratio
    const totalRecords = monthAttendance.length;
    const presentRatio = totalRecords ? daysPresent / totalRecords : 0;
    if (totalRecords > 0) {
      if (presentRatio >= 0.9) setValue("sentiment", "praise");
      else if (presentRatio >= 0.7) setValue("sentiment", "neutral");
      else if (presentRatio >= 0.5) setValue("sentiment", "improvement");
      else setValue("sentiment", "warning");
    }

    setAutoFilledKey(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, monthValue, isCreating, open, autoFillLoading, monthSales, monthAttendance, ledgerEntries, selAgent]);

  // Reset the "already filled" tracker when the dialog closes
  useEffect(() => {
    if (!open) setAutoFilledKey(null);
  }, [open]);

  // Manual re-fill button
  function handleManualAutoFill() {
    if (!selAgent) {
      toast.error("Select an agent first");
      return;
    }
    if (!monthValue) {
      toast.error("Select a month first");
      return;
    }

    if (selAgent.salary != null) {
      setValue("base_salary", Number(selAgent.salary), { shouldValidate: true });
    }
    if (monthSales) {
      setValue("total_sales", Number(monthSales.amount), { shouldValidate: true });
    }
    const daysPresent = monthAttendance.filter((r) => r.status === "present").length;
    const daysAbsent = monthAttendance.filter((r) => r.status === "absent").length;
    const daysLate = monthAttendance.filter((r) => r.status === "late").length;
    const daysLeave = monthAttendance.filter((r) => r.status === "leave").length;
    const totalHours = monthAttendance.reduce((s, r) => s + (r.total_hours ?? 0), 0);
    setValue("days_present", daysPresent, { shouldValidate: true });
    setValue("days_absent", daysAbsent, { shouldValidate: true });
    setValue("days_late", daysLate, { shouldValidate: true });
    setValue("days_leave", daysLeave, { shouldValidate: true });
    setValue("total_hours", Number(totalHours.toFixed(2)), { shouldValidate: true });

    const bonusSum = ledgerEntries
      .filter((e) => e.entry_type === "bonus")
      .reduce((s, e) => s + Number(e.amount), 0);
    const deductionSum = ledgerEntries
      .filter((e) => e.entry_type === "deduction")
      .reduce((s, e) => s + Number(e.amount), 0);
    setValue("bonus", Number(bonusSum.toFixed(2)), { shouldValidate: true });
    setValue("deduction", Number(deductionSum.toFixed(2)), { shouldValidate: true });

    toast.success("Auto-filled from existing data");
    setAutoFilledKey(`${agentId}|${monthValue}`);
  }

  // Live preview of computed fields
  const base = Number(watch("base_salary") ?? 0);
  const bonus = Number(watch("bonus") ?? 0);
  const ded = Number(watch("deduction") ?? 0);
  const sales = Number(watch("total_sales") ?? 0);
  const target = Number(watch("sales_target") ?? 0);
  const net = base + bonus - ded;
  const achPct = target ? (sales / target) * 100 : 0;

  // Auto-fill summary stats (what was found)
  const autoFillStats = isCreating && selAgent && monthValue ? {
    attendanceRecords: monthAttendance.length,
    salesRecord: monthSales ? Number(monthSales.amount) : null,
    ledgerEntries: ledgerEntries.length,
    baseSalaryFromAgent: selAgent.salary ?? null,
  } : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="border-b border-border/40 p-5">
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            {editing ? "Edit Report" : "New Monthly Report"}
          </DialogTitle>
          <DialogDescription>
            Fill in the agent's monthly performance. Net salary & achievement % are calculated automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-5">
          {/* agent + month + sentiment */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Agent</Label>
              <Select value={agentId} onValueChange={(v) => setValue("agent_id", v, { shouldValidate: true })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name} · {a.employee_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.agent_id && <p className="text-xs text-destructive">{errors.agent_id.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Input type="month" {...register("month")} />
              {errors.month && <p className="text-xs text-destructive">{errors.month.message}</p>}
            </div>
          </div>

          {/* AUTO-FILL banner (only when creating) */}
          {isCreating && selAgent && monthValue && (
            <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/8 to-transparent p-4">
              <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/8 blur-2xl" />
              <div className="relative flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/25">
                    {autoFillLoading ? (
                      <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    ) : (
                      <Sparkles className="size-4 text-primary" />
                    )}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-primary">Auto-fill from existing data</p>
                    <p className="text-[11px] text-muted-foreground/70">
                      {autoFillLoading
                        ? "Loading monthly data…"
                        : autoFillStats
                          ? `Base salary · ${autoFillStats.attendanceRecords} attendance records · ${autoFillStats.ledgerEntries} ledger entries${autoFillStats.salesRecord != null ? ` · ₨${autoFillStats.salesRecord.toLocaleString()} sales` : ""}`
                          : "Pick an agent + month to auto-fill"}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleManualAutoFill}
                  disabled={autoFillLoading || !selAgent || !monthValue}
                  className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                >
                  <Sparkles className="size-3.5" />
                  {autoFillLoading ? "Loading…" : autoFilledKey === `${agentId}|${monthValue}` ? "Re-fill" : "Auto-fill"}
                </Button>
              </div>
            </div>
          )}

          {/* sentiment selector */}
          <div className="space-y-1.5">
            <Label>Sentiment</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SENTIMENTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setValue("sentiment", s.value)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all",
                    sentiment === s.value
                      ? cn(s.bg, s.color, "border-current/40 ring-1", s.ring)
                      : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50",
                  )}
                >
                  <s.icon className="size-3.5" /> {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* live preview */}
          {(selAgent || net || achPct) && (
            <div className="grid gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-primary/60">Net Salary</p>
                <p className="font-mono text-lg font-bold text-primary">{formatPKR(net)}</p>
                <p className="text-[10px] text-muted-foreground/60">{formatPKR(base)} + {formatPKR(bonus)} − {formatPKR(ded)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-info/60">Achievement</p>
                <p className="font-mono text-lg font-bold text-info">{achPct.toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground/60">{formatPKR(sales)} / {formatPKR(target)}</p>
              </div>
              <div className="flex items-center justify-end">
                {selAgent && (
                  <div className="flex items-center gap-2 rounded-xl bg-black/15 px-3 py-1.5">
                    <div className="size-7 overflow-hidden rounded-lg ring-1 ring-border">
                      {selAgent.profile_picture_url ? (
                        <SecureImage path={selAgent.profile_picture_url} alt={selAgent.full_name} className="size-full object-cover" />
                      ) : (
                        <div className="grid size-full place-items-center bg-primary/15 text-[10px] font-bold text-primary">
                          {initials(selAgent.full_name)}
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-medium">{selAgent.full_name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* salary section */}
          <FormSection title="Salary Breakdown" icon={Banknote}>
            <Field label="Base Salary (₨)" register={register("base_salary")} type="number" step="0.01" error={errors.base_salary?.message} />
            <Field label="Bonus (₨)" register={register("bonus")} type="number" step="0.01" error={errors.bonus?.message} />
            <Field label="Deduction (₨)" register={register("deduction")} type="number" step="0.01" error={errors.deduction?.message} />
          </FormSection>

          {/* sales section */}
          <FormSection title="Sales Performance" icon={Target}>
            <Field label="Total Sales (₨)" register={register("total_sales")} type="number" step="0.01" error={errors.total_sales?.message} />
            <Field label="Sales Target (₨)" register={register("sales_target")} type="number" step="0.01" error={errors.sales_target?.message} />
          </FormSection>

          {/* scores section */}
          <FormSection title="Performance Scores (0–100)" icon={Award}>
            <Field label="Performance" register={register("performance_score")} type="number" min={0} max={100} error={errors.performance_score?.message} />
            <Field label="Behavior" register={register("behavior_score")} type="number" min={0} max={100} error={errors.behavior_score?.message} />
            <Field label="Attendance" register={register("attendance_score")} type="number" min={0} max={100} error={errors.attendance_score?.message} />
            <Field label="Punctuality" register={register("punctuality_score")} type="number" min={0} max={100} error={errors.punctuality_score?.message} />
          </FormSection>

          {/* attendance summary */}
          <FormSection title="Attendance Summary" icon={CheckCircle2}>
            <Field label="Days Present" register={register("days_present")} type="number" error={errors.days_present?.message} />
            <Field label="Days Absent" register={register("days_absent")} type="number" error={errors.days_absent?.message} />
            <Field label="Days Late" register={register("days_late")} type="number" error={errors.days_late?.message} />
            <Field label="Days Leave" register={register("days_leave")} type="number" error={errors.days_leave?.message} />
            <Field label="Total Hours" register={register("total_hours")} type="number" step="0.01" error={errors.total_hours?.message} />
          </FormSection>

          {/* notes */}
          <div className="space-y-1.5">
            <Label>Headline (optional)</Label>
            <Input placeholder="e.g. Excellent month — closed 3 key deals" {...register("headline")} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Detailed feedback for the agent..."
              rows={4}
              {...register("notes")}
            />
          </div>

          {/* actions */}
          <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              <X className="size-4" /> Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Report"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── small form helpers ─────────────────────────────────────────────────────

function FormSection({ title, icon: Icon, children }: { title: string; icon: typeof Banknote; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-secondary/15 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
        <Icon className="size-3.5 text-primary" /> {title}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  register,
  type = "text",
  error,
  ...rest
}: {
  label: string;
  register: ReturnType<typeof useForm<ReportForm>>["register"] extends (...args: infer A) => infer R ? R : never;
  type?: string;
  error?: string;
  [k: string]: unknown;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px]">{label}</Label>
      <Input type={type} step={type === "number" ? "0.01" : undefined} {...(register as any)} {...rest} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── stat card ──────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  icon: Icon,
  color,
  bg,
  ring,
  suffix,
  compact,
}: {
  label: string;
  value: string;
  icon: typeof Banknote;
  color: string;
  bg: string;
  ring: string;
  suffix?: string;
  compact?: boolean;
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl px-3 py-3 sm:px-4 sm:py-4">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl ring-1 sm:size-10", bg, ring)}>
        <Icon className={cn("size-4", color)} />
      </span>
      <div className="min-w-0">
        <p className={cn("font-mono font-bold tabular-nums leading-tight", color, compact ? "text-base sm:text-lg" : "text-xl sm:text-2xl")}>
          {value}
          {suffix && <span className="text-[10px] text-muted-foreground/60">{suffix}</span>}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/60">{label}</p>
      </div>
    </div>
  );
}
