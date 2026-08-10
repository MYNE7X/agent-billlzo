import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  User, Phone, Mail, MapPin, Calendar, Briefcase, GraduationCap,
  Building2, Clock, Banknote, CreditCard, FileText, ShieldCheck,
  Hash, HeartPulse, Languages, Star, Upload, CheckCircle2,
  TrendingUp, Lock, BarChart3, Award, Smile, Target, Trophy, ArrowRight,
  Verified, Settings, Share2, ChevronRight, Activity,
  AlertCircle, RefreshCw, CalendarDays, ChevronLeft, ChevronRight as ChevronRightIcon,
  Wallet, FileBadge, Moon, Sun,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import {
  useMyAgent, useAgentAttendanceHistory, useAgentDocuments,
  useSaveAgent, useAgentMonthlySales, useAgentSalaryLedger,
  useAgentReports, useAgentMonthAttendance, useOfficesMap,
  type AgentWithRefs, type MonthlyReportWithAgent,
} from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndRegister, uploadAgentFile } from "@/lib/storage";
import {
  formatDate, formatPKR, formatTime, hoursLabel, initials, labelize,
} from "@/lib/billzo";
import { StatusBadge } from "@/components/billzo/StatusBadge";
import { SecureImage } from "@/components/billzo/SecureImage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { effectiveHours, shiftExpectedHours, prettyHM, parseShift } from "@/lib/shift";
import { exportAgentAttendancePDF } from "@/lib/export";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/my-profile")({
  component: MyProfilePage,
});

// ── helpers ───────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="group relative flex items-start gap-3 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 transition-all duration-200 hover:border-primary/20 hover:bg-white/[0.06]">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/15 transition-transform duration-200 group-hover:scale-110">
        <Icon className="size-4 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium leading-snug">{value}</p>
      </div>
    </div>
  );
}

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {Icon && (
        <span className="grid size-6 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/20">
          <Icon className="size-3.5 text-primary" />
        </span>
      )}
      <h3 className="flex-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/80">
        {children}
      </h3>
      <span className="h-px w-12 bg-gradient-to-r from-primary/30 to-transparent" />
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  present: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25",
  absent: "bg-red-500/15 text-red-400 ring-1 ring-red-500/25",
  late: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25",
  half_day: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/25",
  leave: "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/25",
  holiday: "bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/25",
  weekly_off: "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/25",
};

// ── one-time upload button ────────────────────────────────────────────────────

function OneTimeUpload({
  label, alreadyUploaded, onFile, uploading,
}: {
  label: string;
  alreadyUploaded: boolean;
  onFile: (f: File) => void;
  uploading: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  if (alreadyUploaded) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
        <CheckCircle2 className="size-4 shrink-0" />
        <span>{label} uploaded</span>
        <Lock className="ml-auto size-3.5 opacity-50" />
      </div>
    );
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border/50 bg-secondary/20 px-4 py-3 text-sm transition-all hover:border-primary/40 hover:bg-secondary/40 disabled:opacity-50"
      >
        <Upload className="size-4 shrink-0 text-primary/70" />
        <span className="text-left text-sm text-muted-foreground">
          {uploading ? "Uploading…" : `Upload ${label}`}
        </span>
      </button>
    </>
  );
}

// ── attendance tab ────────────────────────────────────────────────────────────

function AttendanceTab({ agent }: { agent: AgentWithRefs }) {
  const agentId = agent.id;
  const shiftTiming = agent.shift_timing;
  const [exporting, setExporting] = useState(false);

  // Default to current month
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  // Fetch attendance for the selected month
  const { data: monthRecords = [], isLoading, isError, error, refetch } = useAgentMonthAttendance(agentId, selectedMonth);

  const shiftHours = shiftExpectedHours(shiftTiming);

  // Summary stats — based on ACTUAL records only (no auto-fill for agents)
  const counts = useMemo(() => {
    const c: Record<string, number> = { present: 0, absent: 0, late: 0, leave: 0, half_day: 0, holiday: 0, totalHours: 0 };
    for (const r of monthRecords) {
      if (r.status && r.status in c) c[r.status] = (c[r.status] ?? 0) + 1;
      // Use clock-in/out hours when available, otherwise shift-based for present/late/half_day
      c["totalHours"]! += effectiveHours(r, shiftTiming);
    }
    return c;
  }, [monthRecords, shiftTiming]);

  const summaryItems = [
    { label: "Present", value: counts["present"] ?? 0, color: "text-emerald-400", bg: "from-emerald-500/15 to-emerald-500/5", ring: "ring-emerald-500/20" },
    { label: "Absent", value: counts["absent"] ?? 0, color: "text-red-400", bg: "from-red-500/15 to-red-500/5", ring: "ring-red-500/20" },
    { label: "Late", value: counts["late"] ?? 0, color: "text-amber-400", bg: "from-amber-500/15 to-amber-500/5", ring: "ring-amber-500/20" },
    { label: "Leave", value: counts["leave"] ?? 0, color: "text-violet-400", bg: "from-violet-500/15 to-violet-500/5", ring: "ring-violet-500/20" },
    { label: "Half Day", value: counts["half_day"] ?? 0, color: "text-blue-400", bg: "from-blue-500/15 to-blue-500/5", ring: "ring-blue-500/20" },
    { label: "Hours", value: `${(counts["totalHours"] ?? 0).toFixed(0)}h`, color: "text-primary", bg: "from-primary/15 to-primary/5", ring: "ring-primary/20" },
  ];

  // Month navigation
  const goPrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y!, m! - 1, 1);
    d.setMonth(d.getMonth() - 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const goNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y!, m! - 1, 1);
    d.setMonth(d.getMonth() + 1);
    // Don't allow navigating past the current month
    if (d > new Date(today.getFullYear(), today.getMonth(), 1)) return;
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthLabel = new Date(selectedMonth + "-01").toLocaleDateString("en-PK", { year: "numeric", month: "long" });
  const shiftParsed = parseShift(shiftTiming);

  // ── Download attendance as PDF ─────────────────────────────────────────────
  async function handleDownloadPDF() {
    if (!monthRecords.length) {
      toast.error("No attendance records to export for this month");
      return;
    }
    setExporting(true);
    try {
      // Build rows for the PDF — actual records only (no auto-fill for agents)
      const pdfRows = monthRecords.map((r) => ({
        date: r.date,
        dayName: new Date(r.date).toLocaleDateString("en-US", { weekday: "short" }),
        clockIn: r.clock_in,
        clockOut: r.clock_out,
        hours: effectiveHours(r, shiftTiming),
        status: r.status ?? "",
        notes: r.notes ?? null,
        autoFilled: false,
      }));

      const sum = counts;
      await exportAgentAttendancePDF(pdfRows, `attendance-${agent.employee_id ?? agent.id}-${selectedMonth}`, {
        agentName: agent.full_name,
        employeeId: agent.employee_id ?? "—",
        department: agent.departments?.name ?? null,
        designation: agent.designations?.name ?? null,
        shiftTiming: shiftTiming ?? null,
        monthLabel,
        summary: {
          daysPresent: sum["present"] ?? 0,
          daysAbsent: sum["absent"] ?? 0,
          daysLate: sum["late"] ?? 0,
          daysLeave: sum["leave"] ?? 0,
          daysHalfDay: sum["half_day"] ?? 0,
          totalHours: sum["totalHours"] ?? 0,
        },
      });
      toast.success("Attendance PDF downloaded");
    } catch (e) {
      console.error("[AttendancePDF] error:", e);
      toast.error(e instanceof Error ? e.message : "Could not generate PDF");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Month navigator + PDF download */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-secondary/20 px-4 py-3">
        <button
          onClick={goPrevMonth}
          className="grid size-8 place-items-center rounded-lg bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            <span className="font-display text-sm font-semibold">{monthLabel}</span>
          </div>
          {shiftParsed && !shiftParsed.flexible && (
            <span className="text-[10px] text-muted-foreground/70">
              Shift: {prettyHM(shiftParsed.startHM!)} → {prettyHM(shiftParsed.endHM!)} · {shiftHours}h/day
            </span>
          )}
        </div>
        <button
          onClick={goNextMonth}
          className="grid size-8 place-items-center rounded-lg bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next month"
          disabled={selectedMonth >= defaultMonth}
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {summaryItems.map((s) => (
          <div key={s.label} className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br p-3 text-center ring-1", s.bg, s.ring)}>
            <p className={cn("font-mono text-lg font-bold tabular-nums sm:text-xl", s.color)}>{s.value}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/70">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Download PDF button */}
      {!isLoading && !isError && monthRecords.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleDownloadPDF}
            variant="outline"
            size="sm"
            className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
            disabled={exporting}
          >
            {exporting ? (
              <>
                <span className="size-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                Generating…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Download PDF
              </>
            )}
          </Button>
        </div>
      )}

      {/* Attendance list — actual records only */}
      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading attendance…</p>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 py-8 px-4 text-center">
          <AlertCircle className="size-6 text-destructive/70" />
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Could not load attendance."}
          </p>
          <button onClick={() => void refetch()} className="flex items-center gap-1.5 rounded-lg bg-secondary/40 px-4 py-1.5 text-xs font-medium hover:bg-secondary/70">
            <RefreshCw className="size-3.5" /> Retry
          </button>
        </div>
      ) : monthRecords.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No attendance records for {monthLabel}.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/30">
                  {["Date", "Day", "In", "Out", "Hours", "Status"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {monthRecords.map((row) => {
                  const dayName = new Date(row.date).toLocaleDateString("en-US", { weekday: "short" });
                  const hrs = effectiveHours(row, shiftTiming);
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-secondary/20">
                      <td className="px-4 py-2.5 font-mono text-xs">{formatDate(row.date)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{dayName}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {row.clock_in ? formatTime(row.clock_in) : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {row.clock_out ? formatTime(row.clock_out) : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {hrs > 0 ? hoursLabel(hrs) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_COLOR[row.status] ?? "")}>
                          {labelize(row.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── documents tab ─────────────────────────────────────────────────────────────

function DocumentsTab({ agentId }: { agentId: string }) {
  const { data: docs = [], isLoading } = useAgentDocuments(agentId);

  const openDoc = async (path: string) => {
    const { data } = await supabase.storage.from("agent-documents").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading documents…</p>;
  if (docs.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {docs.map((doc) => (
        <button
          key={doc.id}
          onClick={() => doc.file_path && openDoc(doc.file_path)}
          className="group flex items-start gap-3 rounded-2xl border border-border/40 bg-secondary/20 p-4 text-left transition-all hover:border-primary/40 hover:bg-secondary/40 hover:shadow-lg hover:shadow-primary/5"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20 transition-all group-hover:from-primary/25 group-hover:to-primary/10">
            <FileText className="size-4 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{doc.file_name}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{labelize(doc.category)}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(doc.uploaded_date)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── salary tab (view-only for agents) ────────────────────────────────────────

function SalaryTab({ agent }: { agent: AgentWithRefs }) {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
  );
  const dbMonth = selectedMonth + "-01";
  const { data: entries = [], isLoading } = useAgentSalaryLedger(agent.id, dbMonth);

  const base = Number(agent.salary ?? 0);
  const deductions = entries
    .filter((e) => e.entry_type === "deduction")
    .reduce((s, e) => s + Number(e.amount), 0);
  const bonuses = entries
    .filter((e) => e.entry_type === "bonus")
    .reduce((s, e) => s + Number(e.amount), 0);
  const netPay = base - deductions + bonuses;

  return (
    <div className="space-y-5">
      {/* month picker */}
      <div className="flex items-center justify-between gap-3">
        <SectionTitle icon={Banknote}>Salary Breakdown</SectionTitle>
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* pay summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/12 to-primary/4 p-5">
          <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/10 blur-2xl" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Base Salary</p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-primary sm:text-3xl">{formatPKR(base)}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/12 to-red-500/4 p-5">
          <div className="absolute -right-6 -top-6 size-24 rounded-full bg-red-500/10 blur-2xl" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Deductions</p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-red-400 sm:text-3xl">− {formatPKR(deductions)}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/12 to-emerald-500/4 p-5">
          <div className="absolute -right-6 -top-6 size-24 rounded-full bg-emerald-500/10 blur-2xl" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Net Pay</p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-emerald-400 sm:text-3xl">{formatPKR(netPay)}</p>
          {bonuses > 0 && (
            <p className="mt-1 text-[10px] text-emerald-400/60">incl. {formatPKR(bonuses)} bonus</p>
          )}
        </div>
      </div>

      {/* ledger entries */}
      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No deductions or bonuses recorded for this month.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/30">
                  {["Type", "Amount", "Remarks"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {entries.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                          row.entry_type === "deduction"
                            ? "bg-red-500/10 text-red-400"
                            : row.entry_type === "bonus"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-primary/10 text-primary",
                        )}
                      >
                        {row.entry_type === "deduction" ? "− " : row.entry_type === "bonus" ? "+ " : ""}
                        {row.entry_type === "base_salary"
                          ? "Base Salary"
                          : row.entry_type === "deduction"
                            ? "Deduction"
                            : "Bonus"}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 font-mono font-semibold tabular-nums",
                        row.entry_type === "deduction"
                          ? "text-red-400"
                          : row.entry_type === "bonus"
                            ? "text-emerald-400"
                            : "text-primary",
                      )}
                    >
                      {row.entry_type === "deduction" ? "−" : "+"} {formatPKR(Number(row.amount))}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{row.remarks ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SectionTitle icon={CreditCard}>Bank Details</SectionTitle>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <InfoRow icon={Banknote} label="Bank Name" value={agent.bank_name} />
        <InfoRow icon={User} label="Account Title" value={agent.account_title} />
        <InfoRow
          icon={CreditCard}
          label="Account Number"
          value={agent.account_number ? "••••  ••••  " + agent.account_number.slice(-4) : null}
        />
        <InfoRow
          icon={CreditCard}
          label="IBAN"
          value={agent.iban ? agent.iban.slice(0, 6) + " ···· " + agent.iban.slice(-4) : null}
        />
      </div>
    </div>
  );
}

// ── monthly sales tab (view-only for agents) ──────────────────────────────────

function MySalesTab({ agentId }: { agentId: string }) {
  const { data: sales = [], isLoading, isError, error, refetch } = useAgentMonthlySales(agentId);

  const total = sales.reduce((s, r) => s + Number(r.amount), 0);
  const best = sales.length ? Math.max(...sales.map((s) => Number(s.amount))) : 0;
  const avg = sales.length ? total / sales.length : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading sales data…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 py-8 px-4 text-center">
        <AlertCircle className="size-6 text-destructive/70" />
        <div>
          <p className="text-sm font-semibold text-destructive">Could not load sales data</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Check your connection or try again."}
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-1.5 rounded-lg bg-secondary/40 px-4 py-1.5 text-xs font-medium transition-colors hover:bg-secondary/70"
        >
          <RefreshCw className="size-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionTitle icon={TrendingUp}>Sales Performance</SectionTitle>
      {/* summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Total Sales", value: formatPKR(total), color: "text-emerald-400", bg: "from-emerald-500/12 to-emerald-500/4", ring: "ring-emerald-500/20" },
          { label: "Best Month", value: formatPKR(best), color: "text-primary", bg: "from-primary/12 to-primary/4", ring: "ring-primary/20" },
          { label: "Monthly Average", value: formatPKR(avg), color: "text-amber-400", bg: "from-amber-500/12 to-amber-500/4", ring: "ring-amber-500/20" },
        ].map((s) => (
          <div key={s.label} className={cn("relative overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-br p-5 ring-1", s.bg, s.ring)}>
            <div className="absolute -right-6 -top-6 size-24 rounded-full bg-current/10 blur-2xl" />
            <TrendingUp className={cn("mb-2 size-5 opacity-70", s.color)} />
            <p className={cn("font-mono text-xl font-bold tabular-nums sm:text-2xl", s.color)}>{s.value}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">{s.label}</p>
          </div>
        ))}
      </div>

      {sales.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No sales data yet. Ask your admin to add your monthly records.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/30">
                  {["Month", "Sales Amount", "Notes"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {sales.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-secondary/20">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {new Date(row.month).toLocaleDateString("en-PK", { month: "long", year: "numeric" })}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-emerald-400">{formatPKR(Number(row.amount))}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── not-linked placeholder ────────────────────────────────────────────────────

function NotLinked({ name }: { name?: string | null }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="relative">
        <div className="absolute -inset-4 rounded-full bg-primary/5 blur-xl" />
        <div className="relative flex size-20 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10">
          <User className="size-9 text-primary/60" />
        </div>
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{name ?? "Your account"} is not linked to an agent profile</h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          Ask your Super Admin or Admin to link your account to your agent profile.
        </p>
      </div>
    </div>
  );
}

// ── TikTok-style stats pill (followers/following/likes → Joined/Hours/Status) ─

function StatPill({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-base font-bold tabular-nums sm:text-lg">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</span>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

function MyProfilePage() {
  const { user, profile } = useAuth();
  const { data: agent, isLoading, refetch } = useMyAgent(user?.id);
  const save = useSaveAgent();
  const officesMap = useOfficesMap();
  const { data: history = [] } = useAgentAttendanceHistory(agent?.id, 90);
  const { data: reports = [] } = useAgentReports(agent?.id);

  const [uploadingDp, setUploadingDp] = useState(false);
  const [uploadingCnicFront, setUploadingCnicFront] = useState(false);
  const [uploadingCnicBack, setUploadingCnicBack] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!agent) return <NotLinked name={profile?.full_name ?? profile?.email} />;

  const dept = agent.departments?.name;
  const desig = agent.designations?.name;
  const totalHours = history.reduce((s, r) => s + (r.total_hours ?? 0), 0);
  const daysPresent = history.filter((r) => r.status === "present").length;
  const lastReport = reports[0];

  // ── upload handlers (one-time: field must be empty) ───────────────────────
  async function handleDpUpload(file: File) {
    if (!agent || agent.profile_picture_url) return;
    setUploadingDp(true);
    try {
      const path = await uploadAgentFile(agent.id, "profile_picture", file);
      await save.mutateAsync({ id: agent.id, values: { profile_picture_url: path } as never });
      toast.success("Profile picture uploaded!");
      void refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingDp(false);
    }
  }

  async function handleCnicFront(file: File) {
    if (!agent || agent.cnic_front_url) return;
    setUploadingCnicFront(true);
    try {
      const path = await uploadAndRegister({ agentId: agent.id, category: "cnic_front", file, uploadedBy: user?.id });
      await save.mutateAsync({ id: agent.id, values: { cnic_front_url: path } as never });
      toast.success("CNIC front uploaded!");
      void refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingCnicFront(false);
    }
  }

  async function handleCnicBack(file: File) {
    if (!agent || agent.cnic_back_url) return;
    setUploadingCnicBack(true);
    try {
      const path = await uploadAndRegister({ agentId: agent.id, category: "cnic_back", file, uploadedBy: user?.id });
      await save.mutateAsync({ id: agent.id, values: { cnic_back_url: path } as never });
      toast.success("CNIC back uploaded!");
      void refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingCnicBack(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl animate-rise">

      {/* ── TIKTOK-STYLE PROFILE FRAME ────────────────────────────────────────
       * Cover image / gradient → overlapping story-ring avatar →
       * name + verified tick → stats strip → action buttons
       */}
      <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-card shadow-2xl shadow-black/40">
        {/* cover: animated gradient w/ mesh blobs */}
        <div className="relative h-36 w-full overflow-hidden sm:h-44">
          {/* gradient base */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(120deg, oklch(0.30 0.10 250) 0%, oklch(0.36 0.12 280) 35%, oklch(0.40 0.13 200) 65%, oklch(0.42 0.14 160) 100%)",
            }}
          />
          {/* mesh blobs */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-10 -top-10 size-40 rounded-full bg-primary/30 blur-3xl" />
            <div className="absolute -right-8 top-4 size-36 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 size-32 rounded-full bg-cyan-400/15 blur-2xl" />
          </div>
          {/* noise / grain */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, oklch(1 0 0 / 0.4) 0, transparent 1px), radial-gradient(circle at 70% 70%, oklch(1 0 0 / 0.3) 0, transparent 1px), radial-gradient(circle at 40% 80%, oklch(1 0 0 / 0.25) 0, transparent 1px)",
              backgroundSize: "12px 12px, 18px 18px, 24px 24px",
            }}
          />
          {/* top-right action chips */}
          <div className="absolute right-3 top-3 flex gap-2">
            <button
              onClick={() => void refetch()}
              className="grid size-8 place-items-center rounded-full bg-black/30 text-white/80 backdrop-blur-md transition-colors hover:bg-black/50"
              aria-label="Refresh"
            >
              <Settings className="size-3.5" />
            </button>
            <button
              onClick={() => toast.info("Share profile coming soon")}
              className="grid size-8 place-items-center rounded-full bg-black/30 text-white/80 backdrop-blur-md transition-colors hover:bg-black/50"
              aria-label="Share"
            >
              <Share2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* avatar (story-ring) + identity */}
        <div className="relative px-5 pb-5">
          {/* avatar overlapping cover */}
          <div className="-mt-14 flex items-end justify-between sm:-mt-16">
            <div className="relative">
              {/* story ring */}
              <div
                className="rounded-full p-[3px]"
                style={{
                  background:
                    "conic-gradient(from 0deg, oklch(0.76 0.15 178), oklch(0.70 0.20 280), oklch(0.72 0.20 200), oklch(0.76 0.15 178))",
                }}
              >
                <div className="rounded-full bg-background p-[3px]">
                  <div className="size-20 overflow-hidden rounded-full ring-1 ring-border/40 sm:size-24">
                    {agent.profile_picture_url ? (
                      <SecureImage path={agent.profile_picture_url} alt={agent.full_name} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/30 to-indigo-500/20">
                        <span className="text-2xl font-bold text-primary/90">{initials(agent.full_name)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* online dot */}
              <span className="absolute bottom-1 right-1 flex size-4 items-center justify-center rounded-full border-2 border-background bg-emerald-500 shadow-md">
                <span className="size-1.5 animate-pulse rounded-full bg-white/80" />
              </span>
            </div>

            {/* right-side action buttons (TikTok style) */}
            <div className="mb-1 flex items-center gap-2">
              <Button asChild size="sm" variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary hover:bg-primary/20">
                <Link to="/reports">
                  <BarChart3 className="size-3.5" /> View Reports
                </Link>
              </Button>
            </div>
          </div>

          {/* name + verified tick */}
          <div className="mt-3 flex items-center gap-1.5">
            <h1 className="bg-gradient-to-r from-foreground via-foreground/90 to-foreground/60 bg-clip-text text-xl font-extrabold tracking-tight text-transparent sm:text-2xl">
              {agent.full_name}
            </h1>
            <span className="grid size-5 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-blue-500 shadow-sm">
              <Verified className="size-3.5 text-white fill-white" />
            </span>
          </div>

          {/* subtitle */}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {desig && <span className="font-medium text-foreground/80">{desig}</span>}
            {dept && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{dept}</span>
              </>
            )}
          </p>

          {/* ID chips */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              <Hash className="size-3 text-primary/70" />{agent.employee_id}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              <Hash className="size-3 text-primary/70" />{agent.reference_id}
            </span>
            <StatusBadge value={agent.status} />
          </div>

          {/* stats strip — TikTok followers/following/likes */}
          <div className="mt-4 flex items-center justify-around rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
            <StatPill value={agent.joining_date ? new Date(agent.joining_date).getFullYear() : "—"} label="Joined" />
            <span className="h-8 w-px bg-border/30" />
            <StatPill value={daysPresent} label="Days Present" />
            <span className="h-8 w-px bg-border/30" />
            <StatPill value={`${totalHours.toFixed(0)}h`} label="Total Hours" />
            <span className="h-8 w-px bg-border/30" />
            <StatPill
              value={lastReport ? lastReport.overall_score.toFixed(0) : "—"}
              label="Score"
            />
          </div>

          {/* quick tags */}
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              [Building2, officesMap.get(agent.office_id ?? "")?.office_name ?? null],
              [Clock, agent.shift_timing],
              [Briefcase, agent.employee_type ? labelize(agent.employee_type) : null],
              [MapPin, [agent.city, agent.country].filter(Boolean).join(", ") || null],
            ] as [React.ElementType, string | null][]).filter(([, v]) => v).map(([Icon, label], i) => (
              <span key={i} className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground/80">
                <Icon className="size-3 text-primary/70" />{label}
              </span>
            ))}
          </div>

          {/* read-only notice */}
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/15 bg-amber-500/8 px-3 py-2 text-[11px] text-amber-400/80">
            <Lock className="size-3.5 shrink-0" />
            <span>Your profile is view-only. Contact your admin to update personal details.</span>
          </div>
        </div>
      </div>

      {/* ── STYLISH SEGMENTED TAB BAR (sticky) ────────────────────────────────
       * Horizontal scrollable pill bar with icon + label always visible.
       * Active tab gets gradient background + glow.
       */}
      <Tabs defaultValue="personal" className="mt-4 space-y-4">
        <div className="sticky top-14 z-20 -mx-1 px-1 lg:top-6">
          <div className="no-scrollbar no-scrollbar-webkit overflow-x-auto pb-1">
            <TabsList className="flex w-max min-w-full gap-1.5 rounded-2xl border border-border/40 bg-card/80 p-1.5 backdrop-blur-lg">
              {[
                { v: "personal", label: "Personal", icon: User },
                { v: "employment", label: "Work", icon: Briefcase },
                { v: "uploads", label: "Uploads", icon: Upload },
                { v: "attendance", label: "Attendance", icon: Calendar },
                { v: "sales", label: "Sales", icon: TrendingUp },
                { v: "salary", label: "Salary", icon: Wallet },
                { v: "reports", label: "Reports", icon: BarChart3 },
                { v: "documents", label: "Documents", icon: FileText },
              ].map((t) => (
                <TabsTrigger
                  key={t.v}
                  value={t.v}
                  className="flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/85 data-[state=active]:text-primary-foreground data-[state=active]:shadow-pop-primary"
                >
                  <t.icon className="size-4" strokeWidth={2.2} />
                  <span>{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        {/* PERSONAL */}
        <TabsContent value="personal" className="glass rounded-2xl p-5 space-y-5">
          <SectionTitle icon={User}>Personal Information</SectionTitle>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <InfoRow icon={User} label="Full Name" value={agent.full_name} />
            <InfoRow icon={User} label="Father's Name" value={agent.father_name} />
            <InfoRow icon={Calendar} label="Date of Birth" value={formatDate(agent.date_of_birth)} />
            <InfoRow icon={User} label="Gender" value={agent.gender} />
            <InfoRow icon={HeartPulse} label="Blood Group" value={agent.blood_group} />
            <InfoRow icon={User} label="Marital Status" value={labelize(agent.marital_status)} />
            <InfoRow icon={ShieldCheck} label="CNIC Number" value={agent.cnic_number} />
            <InfoRow icon={ShieldCheck} label="Passport Number" value={agent.passport_number} />
          </div>

          <SectionTitle icon={Phone}>Contact</SectionTitle>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <InfoRow icon={Phone} label="Phone" value={agent.phone_number} />
            <InfoRow icon={Phone} label="WhatsApp" value={agent.whatsapp_number} />
            <InfoRow icon={Mail} label="Email" value={agent.email} />
            <InfoRow icon={Phone} label="Emergency Contact" value={
              [agent.emergency_contact_name, agent.emergency_contact_number].filter(Boolean).join(" · ") || null
            } />
            <InfoRow icon={MapPin} label="City / Province" value={[agent.city, agent.province].filter(Boolean).join(", ")} />
            <InfoRow icon={MapPin} label="Country" value={agent.country} />
            <InfoRow icon={MapPin} label="Home Address" value={agent.home_address} />
          </div>
        </TabsContent>

        {/* EMPLOYMENT */}
        <TabsContent value="employment" className="glass rounded-2xl p-5 space-y-5">
          <SectionTitle icon={Briefcase}>Employment Details</SectionTitle>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <InfoRow icon={Building2} label="Department" value={dept} />
            <InfoRow icon={Briefcase} label="Designation" value={desig} />
            <InfoRow icon={Building2} label="Office" value={officesMap.get(agent.office_id ?? "")?.office_name ?? null} />
            <InfoRow icon={Calendar} label="Joining Date" value={formatDate(agent.joining_date)} />
            <InfoRow icon={Briefcase} label="Employee Type" value={labelize(agent.employee_type)} />
            <InfoRow icon={Clock} label="Shift Timing" value={agent.shift_timing} />
            <InfoRow icon={Star} label="Status" value={labelize(agent.status)} />
          </div>

          <SectionTitle icon={GraduationCap}>Education & Skills</SectionTitle>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <InfoRow icon={GraduationCap} label="Qualification" value={agent.highest_qualification} />
            <InfoRow icon={GraduationCap} label="Degree" value={agent.degree} />
            <InfoRow icon={GraduationCap} label="Institute" value={agent.institute_name} />
            <InfoRow icon={Star} label="Certifications" value={agent.certifications} />
            <InfoRow icon={Languages} label="Languages" value={agent.languages} />
            <InfoRow icon={Star} label="Skills" value={agent.skills} />
            <InfoRow icon={Briefcase} label="Previous Company" value={agent.previous_company} />
            <InfoRow icon={FileText} label="Experience Summary" value={agent.previous_experience} />
          </div>
        </TabsContent>

        {/* MY UPLOADS */}
        <TabsContent value="uploads" className="glass rounded-2xl p-5 space-y-5">
          <SectionTitle icon={Upload}>Profile Picture (DP)</SectionTitle>
          <div className="space-y-2">
            {agent.profile_picture_url && (
              <div className="mb-3 overflow-hidden rounded-2xl ring-1 ring-border/40">
                <SecureImage path={agent.profile_picture_url} alt="Profile picture" className="h-48 w-full object-cover" />
              </div>
            )}
            <OneTimeUpload
              label="Profile Picture"
              alreadyUploaded={Boolean(agent.profile_picture_url)}
              onFile={handleDpUpload}
              uploading={uploadingDp}
            />
            {!agent.profile_picture_url && (
              <p className="text-[11px] text-muted-foreground">Upload once — you cannot change it after. Contact admin to update.</p>
            )}
          </div>

          <SectionTitle icon={ShieldCheck}>CNIC Documents</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Front Side</p>
              {agent.cnic_front_url && (
                <div className="mb-2 overflow-hidden rounded-2xl ring-1 ring-border/40">
                  <SecureImage path={agent.cnic_front_url} alt="CNIC front" className="h-32 w-full object-cover" />
                </div>
              )}
              <OneTimeUpload
                label="CNIC Front"
                alreadyUploaded={Boolean(agent.cnic_front_url)}
                onFile={handleCnicFront}
                uploading={uploadingCnicFront}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Back Side</p>
              {agent.cnic_back_url && (
                <div className="mb-2 overflow-hidden rounded-2xl ring-1 ring-border/40">
                  <SecureImage path={agent.cnic_back_url} alt="CNIC back" className="h-32 w-full object-cover" />
                </div>
              )}
              <OneTimeUpload
                label="CNIC Back"
                alreadyUploaded={Boolean(agent.cnic_back_url)}
                onFile={handleCnicBack}
                uploading={uploadingCnicBack}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Once uploaded, CNIC images are locked. Contact your admin to make any changes.
          </p>
        </TabsContent>

        {/* ATTENDANCE */}
        <TabsContent value="attendance" className="glass rounded-2xl p-5">
          <AttendanceTab agent={agent} />
        </TabsContent>

        {/* MY SALES */}
        <TabsContent value="sales" className="glass rounded-2xl p-5">
          <MySalesTab agentId={agent.id} />
        </TabsContent>

        {/* SALARY */}
        <TabsContent value="salary" className="glass rounded-2xl p-5 space-y-5">
          <SalaryTab agent={agent} />
        </TabsContent>

        {/* REPORTS */}
        <TabsContent value="reports" className="glass rounded-2xl p-5">
          <ReportsTab agentId={agent.id} />
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="glass rounded-2xl p-5">
          <DocumentsTab agentId={agent.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── reports tab ───────────────────────────────────────────────────────────────

function scoreTone(s: number) {
  if (s >= 85) return "text-emerald-400";
  if (s >= 70) return "text-blue-400";
  if (s >= 50) return "text-amber-400";
  return "text-red-400";
}

function ReportsTab({ agentId }: { agentId: string }) {
  const { data: reports = [], isLoading } = useAgentReports(agentId);

  // Default to the latest report's month, or current month if no reports
  const today = new Date();
  const defaultMonth = reports.length
    ? reports[0]!.month.slice(0, 7)
    : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  // Available months (from reports)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => set.add(r.month.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [reports]);

  // Filtered reports for the selected month
  const filtered = useMemo(
    () => reports.filter((r) => r.month.slice(0, 7) === selectedMonth),
    [reports, selectedMonth],
  );

  // Month navigation
  const goPrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y!, m! - 1, 1);
    d.setMonth(d.getMonth() - 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const goNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y!, m! - 1, 1);
    d.setMonth(d.getMonth() + 1);
    if (d > new Date(today.getFullYear(), today.getMonth(), 1)) return;
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = new Date(selectedMonth + "-01").toLocaleDateString("en-PK", { year: "numeric", month: "long" });
  const hasReportForMonth = filtered.length > 0;

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!reports.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-secondary/40 ring-1 ring-border">
          <BarChart3 className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No reports yet</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Your monthly performance reports will appear here once published by an admin.
        </p>
      </div>
    );
  }

  const latest = filtered[0] ?? reports[0]!;
  const avgOverall = reports.reduce((s, r) => s + r.overall_score, 0) / reports.length;

  return (
    <div className="space-y-5">
      {/* Month navigator */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-secondary/20 px-4 py-3">
        <button
          onClick={goPrevMonth}
          className="grid size-8 place-items-center rounded-lg bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            <span className="font-display text-sm font-semibold">{monthLabel}</span>
          </div>
          <span className="text-[10px] text-muted-foreground/70">
            {hasReportForMonth ? `${filtered.length} report(s)` : "No report for this month"}
          </span>
        </div>
        <button
          onClick={goNextMonth}
          className="grid size-8 place-items-center rounded-lg bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next month"
          disabled={selectedMonth >= currentMonthStr}
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>

      {!hasReportForMonth ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-secondary/40 ring-1 ring-border">
            <BarChart3 className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No report for {monthLabel}</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Reports are published by your admin at the end of each month. Check back later.
          </p>
        </div>
      ) : (
        <>
          {/* hero summary */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/8 to-transparent p-5">
            <div className="absolute -right-8 -top-8 size-32 rounded-full bg-primary/8 blur-2xl" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary/70">
                  <Trophy className="size-3.5" /> Overall Score
                </p>
                <p className={cn("mt-1 font-mono text-3xl font-extrabold tabular-nums", scoreTone(latest.overall_score))}>
                  {latest.overall_score.toFixed(0)}
                  <span className="text-base text-muted-foreground/60">/100</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  {new Date(latest.month).toLocaleDateString("en-PK", { year: "numeric", month: "long" })}
                  {latest.headline && ` · "${latest.headline}"`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Avg (all reports)</p>
                  <p className={cn("font-mono text-lg font-bold tabular-nums", scoreTone(avgOverall))}>
                    {avgOverall.toFixed(0)}/100
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/reports">
                    View All <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* latest scores grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Performance", value: latest.performance_score, icon: Award },
              { label: "Behavior", value: latest.behavior_score, icon: Smile },
              { label: "Attendance", value: latest.attendance_score, icon: CheckCircle2 },
              { label: "Punctuality", value: latest.punctuality_score, icon: Clock },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <s.icon className={cn("size-4", scoreTone(s.value))} />
                <p className={cn("mt-1.5 font-mono text-xl font-bold tabular-nums", scoreTone(s.value))}>
                  {s.value.toFixed(0)}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{s.label}</p>
              </div>
            ))}
          </div>

          {/* salary + sales preview */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary/70">
                <Banknote className="size-3" /> Net Salary
              </div>
              <p className="mt-1.5 font-mono text-2xl font-bold text-primary">{formatPKR(latest.net_salary)}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                Base {formatPKR(latest.base_salary)} · +{formatPKR(latest.bonus)} · −{formatPKR(latest.deduction)}
              </p>
            </div>
            <div className="rounded-xl border border-info/15 bg-info/5 p-4">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-info/70">
                <Target className="size-3" /> Sales Achievement
              </div>
              <p className="mt-1.5 font-mono text-2xl font-bold text-info">{latest.achievement_pct.toFixed(1)}%</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                {formatPKR(latest.total_sales)} of {formatPKR(latest.sales_target)}
              </p>
            </div>
          </div>

          {/* mini history */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              <Activity className="size-3" /> Recent Reports
            </p>
            <div className="space-y-1.5">
              {reports.slice(0, 6).map((r) => (
                <MiniReportRow key={r.id} report={r} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MiniReportRow({ report }: { report: MonthlyReportWithAgent }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 transition-colors hover:bg-white/[0.06]">
      <span className={cn("grid size-7 place-items-center rounded-md bg-secondary/60", scoreTone(report.overall_score))}>
        <BarChart3 className="size-3.5" />
      </span>
      <span className="flex-1 truncate text-xs font-medium">
        {new Date(report.month).toLocaleDateString("en-PK", { year: "numeric", month: "short" })}
        {report.headline && <span className="text-muted-foreground/60"> · {report.headline}</span>}
      </span>
      <span className={cn("font-mono text-sm font-bold tabular-nums", scoreTone(report.overall_score))}>
        {report.overall_score.toFixed(0)}
      </span>
    </div>
  );
}
