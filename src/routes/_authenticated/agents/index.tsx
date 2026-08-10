import React, { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Plus,
  Search,
  FileDown,
  Trash2,
  Eye,
  Users,
  UserCheck,
  UserX,
  Building2,
  Briefcase,
  Calendar,
  X,
  CheckSquare,
  Square,
  CalendarCheck,
  Clock,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/billzo/StatusBadge";
import { SecureImage } from "@/components/billzo/SecureImage";
import { AGENT_STATUSES, formatDate, formatPKR, initials, labelize, todayISO } from "@/lib/billzo";
import { useAgents, useDeleteAgent, useDepartments } from "@/lib/queries";
import { exportCSV, exportExcel, exportPDF, type ExportColumn } from "@/lib/export";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/agents/")({
  component: AgentsPage,
});

type Row = Record<string, unknown>;

const COLUMNS: ExportColumn<Row>[] = [
  { key: "employee_id", label: "Employee ID" },
  { key: "reference_id", label: "Reference ID" },
  { key: "full_name", label: "Full Name" },
  { key: "department", label: "Department" },
  { key: "designation", label: "Designation" },
  { key: "phone_number", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "joining_date", label: "Joining Date" },
  { key: "salary", label: "Salary (PKR)" },
  { key: "status", label: "Status" },
];

/** Unique colour per department name */
function deptColor(name?: string | null) {
  if (!name)
    return { bg: "bg-secondary/60", text: "text-muted-foreground", ring: "ring-border/40" };
  const hues = [210, 160, 280, 40, 320, 185, 0, 240];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  const hue = hues[h % hues.length];
  return {
    bg: `bg-[hsl(${hue}_70%_55%/0.12)]`,
    text: `text-[hsl(${hue}_70%_65%)]`,
    ring: `ring-[hsl(${hue}_70%_55%/0.25)]`,
  };
}

const FEMALE_VALUES = ["Female", "female", "F", "f"];

/** Gender-specific ring colors */
function genderRing(gender?: string | null, selected?: boolean) {
  if (selected) return { shadow: "0 0 0 2px hsl(var(--primary)), 0 0 0 4px hsl(var(--primary)/0.2)", labelColor: "" };
  if (FEMALE_VALUES.includes(gender ?? "")) return { shadow: "0 0 0 2px #e91e8c88, 0 0 8px #e91e8c33", labelColor: "#e91e8c" };
  if (gender === "Male" || gender === "male" || gender === "M" || gender === "m") return { shadow: "0 0 0 2px #0062ff88, 0 0 8px #0062ff33", labelColor: "#0062ff" };
  return { shadow: undefined, labelColor: "" };
}

/** Gradient avatar fallback */
function AgentAvatar({
  path,
  name,
  size = "md",
  selected,
  gender,
}: {
  path?: string | null;
  name: string;
  size?: "sm" | "md";
  selected?: boolean;
  gender?: string | null;
}) {
  const px = size === "sm" ? "size-8" : "size-10";
  const tx = size === "sm" ? "text-xs" : "text-sm";
  const hues = [200, 270, 160, 30, 330];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  const hue = hues[h % hues.length];

  const { shadow } = genderRing(gender, selected);

  if (path) {
    return (
      <SecureImage
        path={path}
        alt={name}
        className={`${px} shrink-0 rounded-xl object-cover transition-all`}
        style={{ boxShadow: shadow } as React.CSSProperties}
      />
    );
  }
  return (
    <span
      className={`${px} ${tx} inline-flex shrink-0 items-center justify-center rounded-xl font-bold transition-all`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 30%), hsl(${hue} 70% 20%))`,
        color: `hsl(${hue} 70% 75%)`,
        boxShadow: selected
          ? "0 0 0 2px hsl(var(--primary)), 0 0 0 4px hsl(var(--primary)/0.25)"
          : `0 0 0 2px hsl(${hue} 70% 50% / 0.25), 0 0 12px hsl(${hue} 70% 50% / 0.12)`,
      }}
    >
      {initials(name)}
    </span>
  );
}

/** Stylish checkbox */
function AgentCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`relative flex size-5 shrink-0 items-center justify-center rounded-md transition-all duration-150 ${
        checked
          ? "bg-primary shadow-lg shadow-primary/30 ring-2 ring-primary/40"
          : "border border-border/50 bg-secondary/40 hover:border-primary/40 hover:bg-primary/5"
      }`}
    >
      {checked && <CheckSquare className="size-3.5 text-background" strokeWidth={3} />}
    </button>
  );
}

/** Floating bulk attendance action bar */
function BulkAttendanceBar({
  selectedIds,
  agents,
  onClear,
}: {
  selectedIds: Set<string>;
  agents: { id: string; full_name: string }[];
  onClear: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const count = selectedIds.size;

  const today = todayISO();
  const [date, setDate] = useState(today);
  const [clockIn, setClockIn] = useState("09:00");
  const [clockOut, setClockOut] = useState("17:00");
  const [status, setStatus] = useState<string>("present");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleMark = async () => {
    setLoading(true);
    const ids = [...selectedIds];
    let success = 0;
    let failed = 0;

    for (const agentId of ids) {
      try {
        const clockInISO = clockIn ? new Date(`${date}T${clockIn}:00`).toISOString() : null;
        const clockOutISO = clockOut ? new Date(`${date}T${clockOut}:00`).toISOString() : null;
        const total_hours =
          clockInISO && clockOutISO
            ? Math.max(
                0,
                (new Date(clockOutISO).getTime() - new Date(clockInISO).getTime()) / 3_600_000,
              )
            : null;

        // Check for existing record
        const { data: existing } = await supabase
          .from("attendance")
          .select("id")
          .eq("agent_id", agentId)
          .eq("date", date)
          .maybeSingle();

        if (existing?.id) {
          const { error } = await supabase
            .from("attendance")
            .update({
              ...(clockInISO ? { clock_in: clockInISO } : {}),
              ...(clockOutISO ? { clock_out: clockOutISO } : {}),
              status: status as never,
              notes: notes || null,
              ...(total_hours !== null ? { total_hours } : {}),
            })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("attendance").insert({
            agent_id: agentId,
            date,
            ...(clockInISO ? { clock_in: clockInISO } : {}),
            ...(clockOutISO ? { clock_out: clockOutISO } : {}),
            status: status as never,
            notes: notes || null,
            ...(total_hours !== null ? { total_hours } : {}),
            created_by: user?.id ?? null,
          });
          if (error) throw error;
        }
        success++;
      } catch {
        failed++;
      }
    }

    setLoading(false);
    void qc.invalidateQueries({ queryKey: ["attendance"] });

    if (failed === 0) {
      toast.success(
        `✓ Marked ${success} agent${success !== 1 ? "s" : ""} as ${labelize(status)} for ${date}`,
      );
      onClear();
    } else {
      toast.warning(`${success} saved, ${failed} failed. Check console.`);
    }
  };

  const selectedNames =
    agents
      .filter((a) => selectedIds.has(a.id))
      .map((a) => a.full_name.split(" ")[0])
      .slice(0, 3)
      .join(", ") + (count > 3 ? ` +${count - 3}` : "");

  return (
    <div
      className="fixed inset-x-0 bottom-20 z-50 mx-auto max-w-2xl px-4 lg:bottom-6"
      style={{ animation: "slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)" }}
    >
      <div
        className="overflow-hidden rounded-2xl shadow-2xl shadow-black/40"
        style={{
          background: "hsl(var(--background)/0.95)",
          backdropFilter: "blur(16px)",
          boxShadow:
            "0 0 0 1px hsl(var(--primary)/0.3), 0 20px 60px hsl(0 0% 0%/0.5), 0 0 40px hsl(var(--primary)/0.12)",
        }}
      >
        {/* gradient top accent */}
        <div
          className="h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--primary)/0.8) 30%, hsl(160 70% 55%/0.6) 70%, transparent)",
          }}
        />

        {/* compact bar */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/25">
            <CalendarCheck className="size-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">
              <span className="text-primary">{count}</span> agent{count !== 1 ? "s" : ""} selected
            </p>
            <p className="truncate text-[11px] text-muted-foreground">{selectedNames}</p>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            <Clock className="size-3.5" />
            Set Time
            <ChevronDown
              className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
          <button
            onClick={onClear}
            className="grid size-8 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* expandable time panel */}
        {expanded && (
          <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Date
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 bg-secondary/40 border-border/50 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Clock In
                </label>
                <Input
                  type="time"
                  value={clockIn}
                  onChange={(e) => setClockIn(e.target.value)}
                  className="h-9 bg-secondary/40 border-border/50 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Clock Out
                </label>
                <Input
                  type="time"
                  value={clockOut}
                  onChange={(e) => setClockOut(e.target.value)}
                  className="h-9 bg-secondary/40 border-border/50 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Status
                </label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9 bg-secondary/40 border-border/50 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="leave">Leave</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Note (optional)
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Bulk marked by admin"
                className="bg-secondary/40 border-border/50 text-sm"
              />
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-muted-foreground">
                Will <strong>create or update</strong> records for {count} agent
                {count !== 1 ? "s" : ""} on {date}
              </p>
              <Button
                size="sm"
                onClick={() => void handleMark()}
                disabled={loading}
                className="gap-1.5 shadow-lg shadow-primary/25"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CalendarCheck className="size-4" />
                )}
                {loading ? "Saving…" : `Save ${count} Record${count !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}

function AgentsPage() {
  const { isSuperAdmin, isStaff } = useAuth();
  const navigate = useNavigate();

  // Agents must not access this page — redirect to their dashboard
  if (!isStaff) {
    void navigate({ to: "/dashboard" });
    return null;
  }

  const { data: agents, isLoading } = useAgents();
  const { data: departments } = useDepartments();
  const del = useDeleteAgent();

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (agents ?? []).filter((a) => {
      const matches =
        !term ||
        [a.full_name, a.employee_id, a.reference_id, a.cnic_number, a.phone_number, a.email, a.city]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      return (
        matches &&
        (dept === "all" || a.department_id === dept) &&
        (status === "all" || a.status === status)
      );
    });
    // Sort: Female first → Male → Other
    const genderOrder = (g: string | null | undefined) => {
      if (FEMALE_VALUES.includes(g ?? "")) return 0;
      if (["Male", "male", "M", "m"].includes(g ?? "")) return 1;
      return 2;
    };
    return [...list].sort((a, b) => genderOrder(a.gender) - genderOrder(b.gender));
  }, [agents, q, dept, status]);

  const activeCount = (agents ?? []).filter((a) => a.status === "active").length;
  const inactiveCount = (agents ?? []).filter((a) => a.status !== "active").length;

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));
  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((a) => next.delete(a.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((a) => next.add(a.id));
        return next;
      });
    }
  };

  const exportRows: Row[] = filtered.map((a) => ({
    employee_id: a.employee_id,
    reference_id: a.reference_id,
    full_name: a.full_name,
    department: a.departments?.name ?? "",
    designation: a.designations?.name ?? "",
    phone_number: a.phone_number ?? "",
    email: a.email ?? "",
    joining_date: a.joining_date ?? "",
    salary: a.salary ?? "",
    status: labelize(a.status),
  }));

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    del.mutate(id, {
      onSuccess: () => toast.success("Agent deleted"),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <header className="animate-rise flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Agent Directory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} of {agents?.length ?? 0} agents
            {selectedIds.size > 0 && (
              <span className="ml-2 font-semibold text-primary">· {selectedIds.size} selected</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-secondary/30 p-1">
            <button
              onClick={() => exportCSV(exportRows, COLUMNS, "billzo-agents")}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <FileDown className="size-3.5" /> CSV
            </button>
            <button
              onClick={() => void exportExcel(exportRows, COLUMNS, "billzo-agents")}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <FileDown className="size-3.5" /> Excel
            </button>
            <button
              onClick={() =>
                void exportPDF(exportRows, COLUMNS, "billzo-agents", "Billzo — Agents Report")
              }
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <FileDown className="size-3.5" /> PDF
            </button>
          </div>
          <Button size="sm" asChild className="gap-1.5 shadow-lg shadow-primary/20">
            <Link to="/agents/new">
              <Plus className="size-4" /> Add Agent
            </Link>
          </Button>
        </div>
      </header>

      {/* ── Quick stat strip ── */}
      <div className="animate-rise grid grid-cols-3 gap-2 sm:gap-3">
        {[
          {
            label: "Total",
            value: agents?.length ?? 0,
            icon: Users,
            color: "text-primary",
            bg: "bg-primary/10",
            ring: "ring-primary/20",
          },
          {
            label: "Active",
            value: activeCount,
            icon: UserCheck,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            ring: "ring-emerald-500/20",
          },
          {
            label: "Other",
            value: inactiveCount,
            icon: UserX,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
            ring: "ring-amber-500/20",
          },
        ].map((s) => (
          <div key={s.label} className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-xl ring-1 ${s.bg} ${s.ring}`}
            >
              <s.icon className={`size-4 ${s.color}`} />
            </span>
            <div>
              <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search / filter bar ── */}
      <div className="glass animate-rise flex flex-col gap-3 rounded-2xl p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            className="border-border/50 bg-secondary/30 pl-9 placeholder:text-muted-foreground/50 focus:border-primary/50"
            placeholder="Search name, ID, CNIC, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="border-border/50 bg-secondary/30 sm:w-44">
            <Building2 className="mr-2 size-3.5 text-muted-foreground/60" />
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {(departments ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="border-border/50 bg-secondary/30 sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {AGENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {labelize(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Staff bulk-select hint ── */}
      {isStaff && !isLoading && filtered.length > 0 && (
        <div className="animate-rise flex items-center gap-2 text-[11px] text-muted-foreground/70">
          <Square className="size-3.5" />
          Tick agents to bulk-mark attendance in one click
        </div>
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <div className="glass animate-rise flex items-center justify-center gap-3 rounded-2xl py-16 text-sm text-muted-foreground">
          <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading agents…
        </div>
      ) : !filtered.length ? (
        <div className="glass animate-rise flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Users className="size-6 text-primary/60" />
          </span>
          <p className="font-medium">No agents found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="glass animate-rise hidden overflow-hidden rounded-2xl md:block">
            <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-gradient-to-r from-secondary/60 via-secondary/40 to-secondary/60">
                    {isStaff && (
                      <th className="px-4 py-3.5 w-10">
                        <AgentCheckbox checked={allFilteredSelected} onChange={toggleAll} />
                      </th>
                    )}
                    {[
                      "Agent",
                      "Employee ID",
                      "Department",
                      "Designation",
                      "Joined",
                      "Salary",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-3.5 ${h === "Actions" ? "text-right" : "text-left"}`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                          {h}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.map((a, idx) => {
                    const dc = deptColor(a.departments?.name);
                    const sel = selectedIds.has(a.id);
                    const isFemale = FEMALE_VALUES.includes(a.gender ?? "");
                    const isMale = ["Male", "male", "M", "m"].includes(a.gender ?? "");
                    // Insert a gender divider row when the gender group changes
                    const prevGender = idx > 0 ? filtered[idx - 1].gender : null;
                    const prevIsFemale = FEMALE_VALUES.includes(prevGender ?? "");
                    const prevIsMale = ["Male", "male", "M", "m"].includes(prevGender ?? "");
                    const showFemaleHeader = idx === 0 && isFemale;
                    const showMaleHeader = isMale && !prevIsMale && !prevIsFemale;
                    const showOtherHeader = !isFemale && !isMale && (prevIsFemale || prevIsMale);
                    return (
                      <React.Fragment key={a.id}>
                        {showFemaleHeader && (
                          <tr key={`hdr-female`}>
                            <td colSpan={isStaff ? 9 : 8} className="px-4 pt-3 pb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "#e91e8c" }}>♀ Female Agents</span>
                                <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, #e91e8c44, transparent)" }} />
                              </div>
                            </td>
                          </tr>
                        )}
                        {showMaleHeader && (
                          <tr key={`hdr-male`}>
                            <td colSpan={isStaff ? 9 : 8} className="px-4 pt-3 pb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "#0062ff" }}>♂ Male Agents</span>
                                <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, #0062ff44, transparent)" }} />
                              </div>
                            </td>
                          </tr>
                        )}
                        {showOtherHeader && (
                          <tr key={`hdr-other`}>
                            <td colSpan={isStaff ? 9 : 8} className="px-4 pt-3 pb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Other</span>
                                <div className="h-px flex-1 bg-border/30" />
                              </div>
                            </td>
                          </tr>
                        )}
                      <tr
                        key={a.id}
                        className={`group transition-all duration-150 ${
                          sel ? "bg-primary/[0.06]" :
                          isFemale ? "hover:bg-pink-500/[0.04]" :
                          isMale ? "hover:bg-blue-500/[0.04]" :
                          "hover:bg-primary/[0.04]"
                        }`}
                      >
                        {isStaff && (
                          <td className="px-4 py-3.5">
                            <AgentCheckbox checked={sel} onChange={() => toggleSelect(a.id)} />
                          </td>
                        )}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3.5">
                            <AgentAvatar
                              path={a.profile_picture_url}
                              name={a.full_name}
                              selected={sel}
                              gender={a.gender}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold leading-tight text-foreground/90">
                                {a.full_name}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                                {a.email ?? a.phone_number ?? "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center rounded-lg bg-secondary/70 px-2.5 py-1 font-mono text-[11px] font-medium tracking-wider text-primary/80 ring-1 ring-primary/15">
                            {a.employee_id}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {a.departments?.name ? (
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ${dc.bg} ${dc.text} ${dc.ring}`}
                            >
                              <Building2 className="size-3 opacity-70" />
                              {a.departments.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {a.designations?.name ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Briefcase className="size-3 text-muted-foreground/40" />
                              {a.designations.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70">
                            <Calendar className="size-3 text-muted-foreground/40" />
                            {formatDate(a.joining_date) ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs font-semibold text-foreground/80 tabular-nums">
                            {formatPKR(a.salary)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge value={a.status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg p-0 text-muted-foreground/60 hover:bg-primary/15 hover:text-primary"
                              asChild
                            >
                              <Link to="/agents/$agentId" params={{ agentId: a.id }}>
                                <Eye className="size-4" />
                              </Link>
                            </Button>
                            {isSuperAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 rounded-lg p-0 text-muted-foreground/40 hover:bg-destructive/15 hover:text-destructive"
                                onClick={() => handleDelete(a.id, a.full_name)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="animate-rise grid gap-3 md:hidden">
            {filtered.map((a) => {
              const dc = deptColor(a.departments?.name);
              const sel = selectedIds.has(a.id);
              const isFem = FEMALE_VALUES.includes(a.gender ?? "");
              const isMal = ["Male", "male", "M", "m"].includes(a.gender ?? "");
              return (
                <div
                  key={a.id}
                  className={`glass group relative overflow-hidden rounded-2xl p-4 transition-all duration-200 ${
                    sel ? "ring-1 ring-primary/50 bg-primary/[0.04]" :
                    isFem ? "ring-1 ring-pink-500/25 hover:ring-pink-500/50" :
                    isMal ? "ring-1 ring-blue-500/20 hover:ring-blue-500/40" :
                    "hover:ring-1 hover:ring-primary/20"
                  }`}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-px"
                    style={{
                      background: isFem
                        ? "linear-gradient(90deg, transparent, #e91e8c55, transparent)"
                        : isMal
                        ? "linear-gradient(90deg, transparent, #0062ff55, transparent)"
                        : "linear-gradient(90deg, transparent, hsl(var(--primary)/0.4), transparent)",
                    }}
                  />
                  <div className="flex items-start gap-3.5">
                    {isStaff && <AgentCheckbox checked={sel} onChange={() => toggleSelect(a.id)} />}
                    <AgentAvatar path={a.profile_picture_url} name={a.full_name} selected={sel} gender={a.gender} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold leading-tight">{a.full_name}</p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                            {a.email ?? a.phone_number ?? "—"}
                          </p>
                        </div>
                        <StatusBadge value={a.status} className="shrink-0" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center rounded-lg bg-secondary/70 px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider text-primary/80 ring-1 ring-primary/15">
                          {a.employee_id}
                        </span>
                        {a.departments?.name && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium ring-1 ${dc.bg} ${dc.text} ${dc.ring}`}
                          >
                            <Building2 className="size-2.5" />
                            {a.departments.name}
                          </span>
                        )}
                        {a.designations?.name && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border/30">
                            <Briefcase className="size-2.5" />
                            {a.designations.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/60">
                          {a.joining_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" />
                              {formatDate(a.joining_date)}
                            </span>
                          )}
                          {a.salary != null && (
                            <span className="font-mono font-semibold tabular-nums text-foreground/70">
                              {formatPKR(a.salary)}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg p-0 text-muted-foreground/60 hover:bg-primary/15 hover:text-primary"
                            asChild
                          >
                            <Link to="/agents/$agentId" params={{ agentId: a.id }}>
                              <Eye className="size-4" />
                            </Link>
                          </Button>
                          {isSuperAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg p-0 text-muted-foreground/40 hover:bg-destructive/15 hover:text-destructive"
                              onClick={() => handleDelete(a.id, a.full_name)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Floating bulk attendance bar ── */}
      {isStaff && selectedIds.size > 0 && (
        <BulkAttendanceBar
          selectedIds={selectedIds}
          agents={(agents ?? []).map((a) => ({ id: a.id, full_name: a.full_name }))}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  );
}
