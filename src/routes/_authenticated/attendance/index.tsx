import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  LogIn,
  LogOut,
  CalendarClock,
  PlusCircle,
  Clock,
  User,
  StickyNote,
  Pencil,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  Trash2,
  FileText,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/billzo/StatusBadge";
import { formatDate, formatTime, hoursLabel, labelize, todayISO } from "@/lib/billzo";
import { useAttendance, useAttendanceRange, useMyAgent, useAgents, useDeleteAttendance, useUpdateAttendance, logEdit } from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { EditorBubble } from "@/components/billzo/EditorBubble";
import {
  AttendanceEditDialog,
  AttendanceAddDialog,
} from "@/components/attendance/AttendanceAdjustDialog";
import type { AttendanceRow } from "@/lib/queries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";
import {
  exportAttendancePDF,
  exportAttendanceExcel,
  type AttendanceExportRow,
  type AttendanceExportSummary,
} from "@/lib/export";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

export const Route = createFileRoute("/_authenticated/attendance/")({
  component: AttendancePage,
});

// ── helpers ───────────────────────────────────────────────────────────────────

function todayMonthISO() {
  return todayISO().slice(0, 7); // "YYYY-MM"
}

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const from = `${ym}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${ym}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function prevMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-PK", { month: "long", year: "numeric" });
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  present: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  absent: { bg: "bg-red-500/10", text: "text-red-400" },
  late: { bg: "bg-amber-500/10", text: "text-amber-400" },
  half_day: { bg: "bg-blue-500/10", text: "text-blue-400" },
  leave: { bg: "bg-violet-500/10", text: "text-violet-400" },
  holiday: { bg: "bg-cyan-500/10", text: "text-cyan-400" },
};

// ── tiny time chip ────────────────────────────────────────────────────────────

function TimeChip({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
        {label}
      </span>
      <span className="font-mono text-sm font-semibold tabular-nums">
        {formatTime(value) ?? <span className="text-muted-foreground/40">—</span>}
      </span>
    </div>
  );
}

// ── mobile attendance card ────────────────────────────────────────────────────

function AttendanceCard({
  row,
  isStaff,
  showDate,
  onDelete,
}: {
  row: AttendanceRow;
  isStaff: boolean;
  showDate?: boolean;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <User className="size-4 text-primary/70" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{row.agents?.full_name ?? "—"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {row.agents?.employee_id && (
                <span className="font-mono text-[10px] text-muted-foreground/60">
                  {row.agents.employee_id}
                </span>
              )}
              {showDate && (
                <span className="font-mono text-[10px] text-primary/60">
                  · {formatDate(row.date)}
                </span>
              )}
            </div>
          </div>
        </div>
        <StatusBadge value={row.status} className="shrink-0" />
      </div>

      <div className="mt-3 flex items-center justify-around rounded-xl bg-secondary/40 py-3 ring-1 ring-border/30">
        <TimeChip label="Clock In" value={row.clock_in} />
        <div className="h-8 w-px bg-border/40" />
        <TimeChip label="Clock Out" value={row.clock_out} />
        <div className="h-8 w-px bg-border/40" />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
            Hours
          </span>
          <span className="font-mono text-sm font-semibold text-primary tabular-nums">
            {hoursLabel(row.total_hours)}
          </span>
        </div>
      </div>

      {isStaff && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {row.notes ? (
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground/70">
              <StickyNote className="size-3 shrink-0 text-muted-foreground/40" />
              <span className="truncate">{row.notes}</span>
            </span>
          ) : (
            <span />
          )}
          <div className="flex shrink-0 items-center gap-1">
            {/* Editor bubble — shows who last adjusted */}
            {row.created_by && (
              <EditorBubble
                editedBy={row.created_by}
                editedAt={row.updated_at}
                entityType="attendance"
                entityId={row.id}
                section="Attendance Record"
                label="Adjusted by"
              />
            )}
            <AttendanceEditDialog
              row={row}
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary"
                >
                  <Pencil className="size-3" /> Edit
                </Button>
              }
            />
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 rounded-lg px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(row.id)}
              >
                <Trash2 className="size-3" /> Delete
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── summary stats bar ─────────────────────────────────────────────────────────

function SummaryBar({ rows }: { rows: AttendanceRow[] }) {
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const totalHours = rows.reduce((s, r) => s + (r.total_hours ?? 0), 0);

  const items = [
    { key: "present", label: "Present", ...STATUS_COLORS.present },
    { key: "absent", label: "Absent", ...STATUS_COLORS.absent },
    { key: "late", label: "Late", ...STATUS_COLORS.late },
    { key: "half_day", label: "Half Day", ...STATUS_COLORS.half_day },
    { key: "leave", label: "Leave", ...STATUS_COLORS.leave },
    { key: "holiday", label: "Holiday", ...STATUS_COLORS.holiday },
  ];

  return (
    <div className="glass animate-rise rounded-2xl p-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-7">
        {items.map((s) => (
          <div key={s.key} className={`rounded-xl ${s.bg} p-3 text-center ring-1 ring-border/20`}>
            <p className={`text-xl font-bold ${s.text}`}>{counts[s.key] ?? 0}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
        <div className="rounded-xl bg-primary/10 p-3 text-center ring-1 ring-border/20">
          <p className="text-xl font-bold text-primary">{totalHours.toFixed(1)}h</p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
            Total Hrs
          </p>
        </div>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

function AttendancePage() {
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const deleteAtt = useDeleteAttendance();

  // Agents must not access this page
  if (!isStaff) {
    void navigate({ to: "/dashboard" });
    return null;
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this attendance record? This cannot be undone.")) return;
    try {
      await deleteAtt.mutateAsync(id);
      toast.success("Attendance record deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete record");
    }
  }

  // view mode
  const [viewMode, setViewMode] = useState<"day" | "month">("day");

  // day mode
  const [date, setDate] = useState(todayISO());

  // month mode
  const [monthYM, setMonthYM] = useState(todayMonthISO());
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: myAgent } = useMyAgent(user?.id ?? null);
  const { data: agents = [] } = useAgents();

  // day query
  const { data: dayRows } = useAttendance(date);

  // month query
  const { from, to } = monthRange(monthYM);
  const { data: monthRows = [], isLoading: monthLoading } = useAttendanceRange(from, to);

  const mine = (dayRows ?? []).find((r) => r.agent_id === myAgent?.id);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["attendance"] });
    void qc.invalidateQueries({ queryKey: ["attendance-range"] });
  };

  // filtered month rows
  const filteredMonthRows = useMemo(() => {
    let rows = monthRows;
    if (filterAgent !== "all") rows = rows.filter((r) => r.agent_id === filterAgent);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    return rows;
  }, [monthRows, filterAgent, filterStatus]);

  const clockIn = async () => {
    if (!myAgent) {
      toast.error("No agent profile linked to your account");
      return;
    }
    const { error } = await supabase
      .from("attendance")
      .insert({
        agent_id: myAgent.id,
        date,
        clock_in: new Date().toISOString(),
        created_by: user?.id ?? null,
      });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Clocked in ✓");
    refresh();
  };

  const clockOut = async () => {
    if (!mine) {
      toast.error("You have not clocked in yet");
      return;
    }
    const { error } = await supabase
      .from("attendance")
      .update({ clock_out: new Date().toISOString() })
      .eq("id", mine.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Clocked out ✓");
    refresh();
  };

  const dayEmpty = !(dayRows ?? []).length;
  const monthEmpty = !filteredMonthRows.length;

  const STATUSES: AttendanceStatus[] = [
    "present",
    "absent",
    "late",
    "half_day",
    "leave",
    "holiday",
  ];

  // ── Export helpers ──────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  function buildExportRows(rows: AttendanceRow[]): AttendanceExportRow[] {
    return rows.map((r) => ({
      date: r.date,
      agentName: r.agents?.full_name ?? "—",
      employeeId: r.agents?.employee_id ?? "—",
      department: r.agents?.departments?.name ?? "—",
      clockIn: r.clock_in ? formatTime(r.clock_in) : "—",
      clockOut: r.clock_out ? formatTime(r.clock_out) : "—",
      hours: r.total_hours,
      status: labelize(r.status),
      notes: r.notes ?? "",
    }));
  }

  function buildSummary(rows: AttendanceRow[]): AttendanceExportSummary {
    const counts = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});
    return {
      totalRecords: rows.length,
      present: counts["present"] ?? 0,
      absent: counts["absent"] ?? 0,
      late: counts["late"] ?? 0,
      halfDay: counts["half_day"] ?? 0,
      leave: counts["leave"] ?? 0,
      holiday: counts["holiday"] ?? 0,
      totalHours: rows.reduce((s, r) => s + (r.total_hours ?? 0), 0),
    };
  }

  function buildFilterLabel(): string {
    const parts: string[] = [];
    if (filterAgent !== "all") {
      const a = agents.find((x) => x.id === filterAgent);
      if (a) parts.push(`Agent: ${a.full_name}`);
    }
    if (filterStatus !== "all") parts.push(`Status: ${labelize(filterStatus)}`);
    return parts.length ? parts.join(" · ") : "All agents · All statuses";
  }

  async function handleExportPDF() {
    const rows =
      viewMode === "day"
        ? (dayRows ?? [])
        : filteredMonthRows;
    if (!rows.length) {
      toast.error("Nothing to export — no attendance records in current view");
      return;
    }
    setExporting(true);
    try {
      const periodLabel =
        viewMode === "day"
          ? new Date(date).toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
          : monthLabel(monthYM);
      const filename =
        viewMode === "day"
          ? `attendance-day-${date}`
          : `attendance-${monthYM}`;
      await exportAttendancePDF(buildExportRows(rows), filename, {
        title: "Attendance Report",
        subtitle: viewMode === "day" ? "Daily Attendance" : "Monthly Attendance",
        periodLabel,
        summary: buildSummary(rows),
        filterLabel: viewMode === "month" ? buildFilterLabel() : undefined,
      });
      toast.success("PDF exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export PDF");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportExcel() {
    const rows =
      viewMode === "day"
        ? (dayRows ?? [])
        : filteredMonthRows;
    if (!rows.length) {
      toast.error("Nothing to export — no attendance records in current view");
      return;
    }
    setExporting(true);
    try {
      const periodLabel =
        viewMode === "day"
          ? new Date(date).toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
          : monthLabel(monthYM);
      const filename =
        viewMode === "day"
          ? `attendance-day-${date}`
          : `attendance-${monthYM}`;
      await exportAttendanceExcel(buildExportRows(rows), filename, {
        title: "Attendance Report",
        subtitle: viewMode === "day" ? "Daily Attendance" : "Monthly Attendance",
        periodLabel,
        summary: buildSummary(rows),
        filterLabel: viewMode === "month" ? buildFilterLabel() : undefined,
      });
      toast.success("Excel exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export Excel");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <header className="animate-rise">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Attendance</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {viewMode === "day"
                ? `${(dayRows ?? []).length} record${(dayRows ?? []).length !== 1 ? "s" : ""} for ${date}`
                : `${filteredMonthRows.length} record${filteredMonthRows.length !== 1 ? "s" : ""} · ${monthLabel(monthYM)}`}
            </p>
          </div>

          {/* controls row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* view toggle */}
            <div className="flex rounded-xl border border-border/50 bg-secondary/30 p-0.5">
              <button
                onClick={() => setViewMode("day")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  viewMode === "day"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Calendar className="size-3.5" /> Day
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  viewMode === "month"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarClock className="size-3.5" /> Month
              </button>
            </div>

            {/* day picker */}
            {viewMode === "day" && (
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 w-40 bg-secondary/30 text-sm"
              />
            )}

            {/* month nav */}
            {viewMode === "month" && (
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-9"
                  onClick={() => setMonthYM(prevMonth(monthYM))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Input
                  type="month"
                  value={monthYM}
                  onChange={(e) => setMonthYM(e.target.value)}
                  className="h-9 w-36 bg-secondary/30 text-sm"
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="size-9"
                  onClick={() => setMonthYM(nextMonth(monthYM))}
                  disabled={monthYM >= todayMonthISO()}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}

            {/* add record */}
            {isStaff && (
              <AttendanceAddDialog
                defaultDate={viewMode === "day" ? date : from}
                createdBy={user?.id}
                trigger={
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <PlusCircle className="size-4" /> Add Record
                  </Button>
                }
              />
            )}

            {/* export menu */}
            {isStaff && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                    disabled={exporting || (viewMode === "day" ? dayEmpty : monthEmpty)}
                  >
                    <Download className="size-4" />
                    <span className="hidden sm:inline">{exporting ? "Exporting…" : "Export"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                    Export current view
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleExportPDF}
                    className="gap-2 cursor-pointer"
                  >
                    <FileText className="size-4 text-red-400" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Stylish PDF</span>
                      <span className="text-[10px] text-muted-foreground">
                        Branded cover + stats + colored table
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleExportExcel}
                    className="gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="size-4 text-emerald-400" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Excel (.xlsx)</span>
                      <span className="text-[10px] text-muted-foreground">
                        Summary + Records sheets
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* ── Month filters (staff) ── */}
      {viewMode === "month" && isStaff && (
        <div className="animate-rise flex flex-wrap items-center gap-2 rounded-xl border border-border/40 bg-secondary/20 px-4 py-3">
          <Filter className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Filter:</span>

          <Select value={filterAgent} onValueChange={setFilterAgent}>
            <SelectTrigger className="h-8 w-44 bg-secondary/40 text-xs">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all">All Agents</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.full_name}
                  <span className="ml-1 text-muted-foreground text-[10px]">· {a.employee_id}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-36 bg-secondary/40 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {labelize(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(filterAgent !== "all" || filterStatus !== "all") && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setFilterAgent("all");
                setFilterStatus("all");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {/* ── Month summary stats ── */}
      {viewMode === "month" && filteredMonthRows.length > 0 && (
        <SummaryBar rows={filteredMonthRows} />
      )}

      {/* Staff (admin/super admin) do not clock in — attendance page is management-only */}

      {/* ── Day view — desktop table ── */}
      {viewMode === "day" && !dayEmpty && (
        <div className="glass animate-rise hidden overflow-hidden rounded-2xl md:block">
          <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-gradient-to-r from-secondary/60 via-secondary/40 to-secondary/60">
                  {[
                    "Agent",
                    "Clock In",
                    "Clock Out",
                    "Hours",
                    "Status",
                    ...(isStaff ? ["Note", ""] : []),
                  ].map((h, i) => (
                    <th key={i} className="px-4 py-3.5 text-left">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                        {h}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {(dayRows ?? []).map((r) => (
                  <AttendanceTableRow key={r.id} row={r} isStaff={isStaff} showDate={false} onDelete={handleDelete} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Day view — mobile cards ── */}
      {viewMode === "day" && !dayEmpty && (
        <div className="animate-rise grid gap-3 md:hidden">
          {(dayRows ?? []).map((r) => (
            <AttendanceCard key={r.id} row={r} isStaff={isStaff} showDate={false} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* ── Month view — desktop table ── */}
      {viewMode === "month" && !monthEmpty && (
        <div className="glass animate-rise hidden overflow-hidden rounded-2xl md:block">
          <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-gradient-to-r from-secondary/60 via-secondary/40 to-secondary/60">
                  {[
                    "Date",
                    "Agent",
                    "Clock In",
                    "Clock Out",
                    "Hours",
                    "Status",
                    ...(isStaff ? ["Note", ""] : []),
                  ].map((h, i) => (
                    <th key={i} className="px-4 py-3.5 text-left">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                        {h}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredMonthRows.map((r) => (
                  <AttendanceTableRow key={r.id} row={r} isStaff={isStaff} showDate={true} onDelete={handleDelete} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Month view — mobile cards ── */}
      {viewMode === "month" && !monthEmpty && (
        <div className="animate-rise grid gap-3 md:hidden">
          {filteredMonthRows.map((r) => (
            <AttendanceCard key={r.id} row={r} isStaff={isStaff} showDate={true} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {viewMode === "month" && monthLoading && (
        <div className="glass animate-rise flex items-center justify-center gap-3 rounded-2xl py-14">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading {monthLabel(monthYM)}…</span>
        </div>
      )}

      {/* ── Empty state ── */}
      {((viewMode === "day" && dayEmpty) ||
        (viewMode === "month" && monthEmpty && !monthLoading)) && (
        <div className="glass animate-rise flex flex-col items-center justify-center gap-3 rounded-2xl py-14 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Clock className="size-6 text-primary/60" />
          </span>
          <div>
            <p className="font-medium">
              {viewMode === "day"
                ? `No records for ${date}`
                : `No records for ${monthLabel(monthYM)}`}
            </p>
            {isStaff && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Use <strong>Add Record</strong> to create a manual entry.
              </p>
            )}
          </div>
        </div>
      )}

      {/* legend */}
      {isStaff && ((viewMode === "day" && !dayEmpty) || (viewMode === "month" && !monthEmpty)) && (
        <p className="hidden text-right text-xs text-muted-foreground md:block">
          Click <strong>Edit</strong> on any row to adjust times, status, or add a note.
        </p>
      )}
    </div>
  );
}

// ── shared desktop table row ──────────────────────────────────────────────────

function AttendanceTableRow({
  row,
  isStaff,
  showDate,
  onDelete,
}: {
  row: AttendanceRow;
  isStaff: boolean;
  showDate: boolean;
  onDelete?: (id: string) => void;
}) {
  return (
    <tr className="transition-colors hover:bg-primary/[0.04]">
      {showDate && (
        <td className="px-4 py-3.5">
          <span className="font-mono text-xs text-muted-foreground">{formatDate(row.date)}</span>
        </td>
      )}
      <td className="px-4 py-3.5">
        <div className="flex flex-col">
          <span className="font-semibold leading-tight">{row.agents?.full_name ?? "—"}</span>
          {row.agents?.employee_id && (
            <span className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">
              {row.agents.employee_id}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="font-mono text-sm tabular-nums">{formatTime(row.clock_in) ?? "—"}</span>
      </td>
      <td className="px-4 py-3.5">
        <span className="font-mono text-sm tabular-nums">{formatTime(row.clock_out) ?? "—"}</span>
      </td>
      <td className="px-4 py-3.5">
        <span className="font-mono text-sm font-semibold text-primary tabular-nums">
          {hoursLabel(row.total_hours)}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge value={row.status} />
      </td>
      {isStaff && (
        <td className="max-w-[160px] px-4 py-3.5">
          {row.notes ? (
            <span className="block truncate text-xs text-muted-foreground/70" title={row.notes}>
              {row.notes}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/30">—</span>
          )}
        </td>
      )}
      {isStaff && (
        <td className="px-4 py-3.5 text-right">
          <div className="flex items-center justify-end gap-1">
            {/* Editor bubble — shows who last adjusted this record */}
            {row.created_by && (
              <EditorBubble
                editedBy={row.created_by}
                editedAt={row.updated_at}
                entityType="attendance"
                entityId={row.id}
                section="Attendance Record"
                label="Adjusted by"
              />
            )}
            <AttendanceEditDialog
              row={row}
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary"
                >
                  <CalendarClock className="size-3.5" /> Edit
                </Button>
              }
            />
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 rounded-lg px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(row.id)}
              >
                <Trash2 className="size-3.5" /> Delete
              </Button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
