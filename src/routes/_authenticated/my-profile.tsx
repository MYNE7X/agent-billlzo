import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  User, Phone, Mail, MapPin, Calendar, Briefcase, GraduationCap,
  Building2, Clock, Banknote, CreditCard, FileText, ShieldCheck,
  Hash, HeartPulse, Languages, Star, Upload, CheckCircle2,
  TrendingUp, Lock,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import {
  useMyAgent, useAgentAttendanceHistory, useAgentDocuments,
  useSaveAgent, useAgentMonthlySales, useAgentSalaryLedger, type AgentWithRefs,
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

export const Route = createFileRoute("/_authenticated/my-profile")({
  component: MyProfilePage,
});

// ── helpers ───────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/3 px-4 py-3 transition-colors hover:bg-white/6">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15">
        <Icon className="size-3.5 text-primary" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium leading-snug">{value}</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/80">
      <span className="h-px flex-1 bg-primary/15" />
      {children}
      <span className="h-px flex-1 bg-primary/15" />
    </h3>
  );
}

const STATUS_COLOR: Record<string, string> = {
  present: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25",
  absent: "bg-red-500/15 text-red-400 ring-1 ring-red-500/25",
  late: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25",
  half_day: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/25",
  leave: "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/25",
  holiday: "bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/25",
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

function AttendanceTab({ agentId }: { agentId: string }) {
  const { data: history = [], isLoading } = useAgentAttendanceHistory(agentId, 90);

  const counts = history.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const totalHours = history.reduce((s, r) => s + (r.total_hours ?? 0), 0);

  const summaryItems = [
    { label: "Days Worked", value: counts["present"] ?? 0, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Absent", value: counts["absent"] ?? 0, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "Late", value: counts["late"] ?? 0, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Leave", value: counts["leave"] ?? 0, color: "text-violet-400", bg: "bg-violet-500/10" },
    { label: "Half Day", value: counts["half_day"] ?? 0, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Total Hours", value: totalHours.toFixed(1) + "h", color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summaryItems.map((s) => (
          <div key={s.label} className={`rounded-xl ${s.bg} p-3 text-center ring-1 ring-border/30`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading attendance…</p>
      ) : history.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No attendance records yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  {["Date", "Clock In", "Clock Out", "Hours", "Status"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {history.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-secondary/20">
                    <td className="px-4 py-2.5 font-mono text-xs">{formatDate(row.date)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{formatTime(row.clock_in)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{formatTime(row.clock_out)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{hoursLabel(row.total_hours)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[row.status] ?? ""}`}>
                        {labelize(row.status)}
                      </span>
                    </td>
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
          className="group flex items-start gap-3 rounded-xl border border-border/40 bg-secondary/20 p-4 text-left transition-all hover:border-primary/40 hover:bg-secondary/40"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-colors group-hover:bg-primary/20">
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
      <SectionTitle>Salary</SectionTitle>

      {/* month picker */}
      <div className="flex items-center gap-3">
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">Month</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* pay summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-5 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Base Salary</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-primary">{formatPKR(base)}</p>
        </div>
        <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-500/5 p-5 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Deductions</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-red-400">− {formatPKR(deductions)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Net Pay</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-400">{formatPKR(netPay)}</p>
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
        <div className="overflow-hidden rounded-xl border border-border/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  {["Type", "Amount", "Remarks"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {entries.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          row.entry_type === "deduction"
                            ? "bg-red-500/10 text-red-400"
                            : row.entry_type === "bonus"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-primary/10 text-primary"
                        }`}
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
                      className={`px-4 py-3 font-semibold tabular-nums ${
                        row.entry_type === "deduction" ? "text-red-400" : row.entry_type === "bonus" ? "text-emerald-400" : "text-primary"
                      }`}
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

      <SectionTitle>Bank Details</SectionTitle>
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
  const { data: sales = [], isLoading } = useAgentMonthlySales(agentId);

  const total = sales.reduce((s, r) => s + Number(r.amount), 0);
  const best = sales.length ? Math.max(...sales.map((s) => Number(s.amount))) : 0;
  const avg = sales.length ? total / sales.length : 0;

  if (isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading sales…</p>;

  return (
    <div className="space-y-5">
      {/* summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Total Sales", value: formatPKR(total), color: "text-emerald-400", bg: "from-emerald-500/10 to-emerald-500/5" },
          { label: "Best Month", value: formatPKR(best), color: "text-primary", bg: "from-primary/10 to-primary/5" },
          { label: "Monthly Average", value: formatPKR(avg), color: "text-amber-400", bg: "from-amber-500/10 to-amber-500/5" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border border-border/30 bg-gradient-to-br ${s.bg} p-5 text-center ring-1 ring-border/20`}>
            <TrendingUp className={`mx-auto mb-2 size-5 ${s.color} opacity-70`} />
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {sales.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No sales data yet. Ask your admin to add your monthly records.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  {["Month", "Sales Amount", "Notes"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {sales.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-secondary/20">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {new Date(row.month).toLocaleDateString("en-PK", { month: "long", year: "numeric" })}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-emerald-400">{formatPKR(Number(row.amount))}</td>
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
        <div className="relative flex size-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
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

// ── main page ─────────────────────────────────────────────────────────────────

function MyProfilePage() {
  const { user, profile } = useAuth();
  const { data: agent, isLoading, refetch } = useMyAgent(user?.id);
  const save = useSaveAgent();

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
    <div className="mx-auto max-w-4xl space-y-5 animate-rise">

      {/* ── HERO CARD ── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br from-[#0f1623] via-[#111827] to-[#0a0f1a] p-0 shadow-2xl shadow-black/40">
        {/* background decorations */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/6 blur-3xl" />
          <div className="absolute -bottom-16 left-1/4 size-56 rounded-full bg-indigo-500/5 blur-3xl" />
          <div className="absolute bottom-0 right-0 size-40 rounded-full bg-violet-500/4 blur-2xl" />
        </div>

        {/* top accent bar */}
        <div className="relative h-1.5 w-full bg-gradient-to-r from-primary via-indigo-400 to-violet-500" />

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">

            {/* avatar */}
            <div className="relative shrink-0 self-start">
              <div className="size-24 overflow-hidden rounded-2xl ring-2 ring-primary/40 ring-offset-2 ring-offset-[#0f1623] shadow-xl sm:size-28">
                {agent.profile_picture_url ? (
                  <SecureImage path={agent.profile_picture_url} alt={agent.full_name} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/25 to-indigo-500/20">
                    <span className="text-3xl font-bold text-primary/90">{initials(agent.full_name)}</span>
                  </div>
                )}
              </div>
              {/* online dot */}
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-[#0f1623] bg-emerald-500 shadow-md">
                <span className="size-2 animate-pulse rounded-full bg-white/80" />
              </span>
            </div>

            {/* identity */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-2xl font-extrabold leading-tight tracking-tight text-transparent sm:text-3xl">
                  {agent.full_name}
                </h1>
                {(desig || dept) && (
                  <p className="mt-1 text-sm text-white/50">
                    {desig ?? "—"}{dept ? ` · ${dept}` : ""}
                  </p>
                )}
              </div>

              {/* ID badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-white/50">
                  <Hash className="size-3 text-primary/60" />{agent.employee_id}
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-white/50">
                  <Hash className="size-3 text-primary/60" />{agent.reference_id}
                </span>
                <StatusBadge value={agent.status} />
              </div>

              {/* quick stats */}
              <div className="flex flex-wrap gap-2">
                {([
                  [Calendar, agent.joining_date ? "Joined " + formatDate(agent.joining_date) : null],
                  [Clock, agent.shift_timing],
                  [Briefcase, agent.employee_type ? labelize(agent.employee_type) : null],
                  [MapPin, [agent.city, agent.country].filter(Boolean).join(", ") || null],
                ] as [React.ElementType, string | null][]).filter(([, v]) => v).map(([Icon, label], i) => (
                  <span key={i} className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-xs text-white/50">
                    <Icon className="size-3 text-primary/70" />{label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* read-only notice */}
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-amber-500/15 bg-amber-500/8 px-4 py-2.5 text-xs text-amber-400/80">
            <Lock className="size-3.5 shrink-0" />
            Your profile is view-only. Contact your admin to update personal details.
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <Tabs defaultValue="personal" className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full sm:w-auto">
            <TabsTrigger value="personal"><User className="size-3.5" /> Personal</TabsTrigger>
            <TabsTrigger value="employment"><Briefcase className="size-3.5" /> Employment</TabsTrigger>
            <TabsTrigger value="uploads"><Upload className="size-3.5" /> My Uploads</TabsTrigger>
            <TabsTrigger value="attendance"><Calendar className="size-3.5" /> Attendance</TabsTrigger>
            <TabsTrigger value="sales"><TrendingUp className="size-3.5" /> My Sales</TabsTrigger>
            <TabsTrigger value="salary"><Banknote className="size-3.5" /> Salary</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="size-3.5" /> Documents</TabsTrigger>
          </TabsList>
        </div>

        {/* PERSONAL — view only */}
        <TabsContent value="personal" className="glass rounded-xl p-5 space-y-5">
          <SectionTitle>Personal Information</SectionTitle>
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

          <SectionTitle>Contact</SectionTitle>
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

        {/* EMPLOYMENT — view only */}
        <TabsContent value="employment" className="glass rounded-xl p-5 space-y-5">
          <SectionTitle>Employment Details</SectionTitle>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <InfoRow icon={Building2} label="Department" value={dept} />
            <InfoRow icon={Briefcase} label="Designation" value={desig} />
            <InfoRow icon={Calendar} label="Joining Date" value={formatDate(agent.joining_date)} />
            <InfoRow icon={Briefcase} label="Employee Type" value={labelize(agent.employee_type)} />
            <InfoRow icon={Clock} label="Shift Timing" value={agent.shift_timing} />
            <InfoRow icon={Star} label="Status" value={labelize(agent.status)} />
          </div>

          <SectionTitle>Education & Skills</SectionTitle>
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

        {/* MY UPLOADS — one-time upload for DP / CNIC */}
        <TabsContent value="uploads" className="glass rounded-xl p-5 space-y-5">
          <SectionTitle>Profile Picture (DP)</SectionTitle>
          <div className="space-y-2">
            {agent.profile_picture_url && (
              <div className="mb-3 overflow-hidden rounded-xl">
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

          <SectionTitle>CNIC Documents</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Front Side</p>
              {agent.cnic_front_url && (
                <div className="mb-2 overflow-hidden rounded-xl">
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
                <div className="mb-2 overflow-hidden rounded-xl">
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
        <TabsContent value="attendance" className="glass rounded-xl p-5">
          <AttendanceTab agentId={agent.id} />
        </TabsContent>

        {/* MY SALES */}
        <TabsContent value="sales" className="glass rounded-xl p-5">
          <MySalesTab agentId={agent.id} />
        </TabsContent>

        {/* SALARY */}
        <TabsContent value="salary" className="glass rounded-xl p-5 space-y-5">
          <SalaryTab agent={agent} />
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="glass rounded-xl p-5">
          <DocumentsTab agentId={agent.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
