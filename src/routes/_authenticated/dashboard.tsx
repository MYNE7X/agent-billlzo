import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  PlaneTakeoff,
  ArrowRight,
  CalendarDays,
  CalendarCheck,
  Banknote,
  TrendingUp,
  TrendingDown,
  Star,
  Hash,
  Briefcase,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MinusCircle,
  Sun,
  Moon,
  Coffee,
  Zap,
  Timer,
  CalendarClock,
  ChevronRight,
  BarChart3,
  Receipt,
  Trophy,
  Activity,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Wifi,
  ShieldAlert,
  Wallet,
  PieChart,
} from "lucide-react";

import { StatCard } from "@/components/billzo/StatCard";
import { StatusBadge } from "@/components/billzo/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  useAgents, useAttendance, useAttendanceRange, useAgentAttendanceHistory, useMyAgent,
  useInsertAttendance, useUpdateAttendance,
  useNetworkSettings, useLogAttendanceViolation,
  useAllReports, useExpenses, useAttendanceViolations,
} from "@/lib/queries";
import { formatDate, formatPKR, formatTime, hoursLabel, todayISO, initials, labelize } from "@/lib/billzo";
import { useAuth } from "@/hooks/useAuth";
import { SecureImage } from "@/components/billzo/SecureImage";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getPublicIP } from "@/lib/network";
import {
  parseShift,
  shouldAutoClockOut,
  expectedClockOut,
  autoClockOutLabel,
  prettyHM,
} from "@/lib/shift";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  present: { icon: CheckCircle2, color: "text-emerald-400" },
  absent: { icon: XCircle, color: "text-red-400" },
  late: { icon: AlertCircle, color: "text-amber-400" },
  half_day: { icon: MinusCircle, color: "text-blue-400" },
  leave: { icon: PlaneTakeoff, color: "text-violet-400" },
  holiday: { icon: Sun, color: "text-cyan-400" },
};

const STATUS_BG: Record<string, string> = {
  present: "from-emerald-500/12 to-emerald-500/5  border-emerald-500/20",
  absent: "from-red-500/12 to-red-500/5          border-red-500/20",
  late: "from-amber-500/12 to-amber-500/5      border-amber-500/20",
  half_day: "from-blue-500/12 to-blue-500/5        border-blue-500/20",
  leave: "from-violet-500/12 to-violet-500/5    border-violet-500/20",
  holiday: "from-cyan-500/12 to-cyan-500/5        border-cyan-500/20",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { label: "Good morning", icon: Coffee };
  if (h < 17) return { label: "Good afternoon", icon: Sun };
  return { label: "Good evening", icon: Moon };
}

// ── Agent personal dashboard ──────────────────────────────────────────────────

function AgentDashboard() {
  const { user, profile } = useAuth();
  const today = todayISO();
  const { data: agent, isLoading } = useMyAgent(user?.id);
  const { data: todayAttendance, refetch: refetchToday } = useAttendance(today);
  const { data: history = [] } = useAgentAttendanceHistory(agent?.id, 90);
  const insertAtt = useInsertAttendance();
  const updateAtt = useUpdateAttendance();
  const qc = useQueryClient();
  const { data: networkSettings = [] } = useNetworkSettings();
  const logViolation = useLogAttendanceViolation();
  const [checkingNetwork, setCheckingNetwork] = useState(false);

  // Active (enabled) allowed IPs — if none configured, no restriction
  const enabledNetworks = networkSettings.filter((n) => n.enabled);

  // Today's record for this agent (computed early — auto-clock-out needs it)
  const todayRecord = useMemo(
    () =>
      agent
        ? ((todayAttendance ?? []).find((r) => r.agent_id === agent.id) ?? null)
        : null,
    [agent, todayAttendance],
  );

  // ── AUTO CLOCK-OUT ───────────────────────────────────────────────────────
  // If the agent has clocked in but not yet clocked out, and the current time
  // is past the expected shift end (e.g. night shift 22:00 → 07:00), we
  // automatically write the clock_out timestamp = expected shift end.
  useEffect(() => {
    if (!agent || !todayRecord || todayRecord.clock_out) return;
    if (!todayRecord.clock_in) return;
    const expected = shouldAutoClockOut(todayRecord.clock_in, agent.shift_timing);
    if (!expected) return;
    // Write the expected shift end as the clock_out time (not "now"), so the
    // total_hours reflects the full shift.
    const payload = {
      id: todayRecord.id,
      values: { clock_out: expected.toISOString() },
    };
    void (async () => {
      try {
        await updateAtt.mutateAsync(payload);
        toast.success(`Auto clock-out at ${formatTime(expected.toISOString())} (end of shift)`, {
          duration: 6000,
        });
        void refetchToday();
        void qc.invalidateQueries({ queryKey: ["attendance-history"] });
      } catch (err) {
        console.warn("auto-clockout failed", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id, agent?.shift_timing, todayRecord?.id, todayRecord?.clock_in, todayRecord?.clock_out]);

  // Live timer — updates every second while the agent is on the clock.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!todayRecord?.clock_in || todayRecord.clock_out) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [todayRecord?.clock_in, todayRecord?.clock_out]);

  // Clock-in / Clock-out handlers
  async function handleClockIn() {
    if (!agent) return;
    setCheckingNetwork(true);

    try {
      // ── Network check ────────────────────────────────────────────────────────
      if (enabledNetworks.length > 0) {
        let currentIP = "";
        try {
          currentIP = await getPublicIP();
        } catch {
          toast.error("Could not verify your network. Please check your internet connection.");
          return;
        }

        const allowed = enabledNetworks.some((n) => n.allowed_ip === currentIP);
        if (!allowed) {
          // Log the violation
          void logViolation.mutateAsync({
            agentId: agent.id,
            ipAddress: currentIP,
            notes: `Attempted from ${currentIP}; allowed: ${enabledNetworks.map((n) => n.allowed_ip).join(", ")}`,
          });
          toast.error(
            "Clock-in blocked — you must be connected to the office WiFi (HMR / HMR 5G) to clock in.",
            { duration: 6000 },
          );
          return;
        }
      }

      // ── Insert attendance ─────────────────────────────────────────────────────
      const now = new Date().toISOString();
      await insertAtt.mutateAsync({
        agent_id: agent.id,
        date: today,
        clock_in: now,
        status: "present",
        ...(user?.id ? { created_by: user.id } : {}),
      });
      toast.success("Clocked in successfully!");
      void refetchToday();
      void qc.invalidateQueries({ queryKey: ["attendance-history"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clock in");
    } finally {
      setCheckingNetwork(false);
    }
  }

  async function handleClockOut(recordId: string) {
    const now = new Date().toISOString();
    try {
      await updateAtt.mutateAsync({
        id: recordId,
        values: { clock_out: now },
      });
      toast.success("Clocked out successfully!");
      void refetchToday();
      void qc.invalidateQueries({ queryKey: ["attendance-history"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clock out");
    }
  }

  const greeting = getGreeting();
  const GreetIcon = greeting.icon;

  // Last 30-day stats
  const last30 = history.slice(0, 30);
  const counts = last30.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const totalHours = last30.reduce((s, r) => s + (r.total_hours ?? 0), 0);

  // Current month stats
  const thisMonth = today.slice(0, 7);
  const monthHistory = history.filter((r) => r.date.startsWith(thisMonth));
  const monthPresent = monthHistory.filter((r) => r.status === "present").length;
  const monthHours = monthHistory.reduce((s, r) => s + (r.total_hours ?? 0), 0);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="relative size-10">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/30 border-t-primary" style={{ animationDuration: "0.9s" }} />
          <div className="absolute inset-1.5 animate-spin rounded-full border-2 border-fuchsia-500/20 border-b-fuchsia-500" style={{ animationDuration: "1.4s", animationDirection: "reverse" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── GREETING HERO ── */}
      <div className="aurora-border glass-strong animate-rise relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <span className="aurora-border-ring" />
        {/* background aurora blobs */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -right-20 -top-24 size-80 animate-aurora rounded-full opacity-50 blur-[100px]"
            style={{ background: "radial-gradient(circle, oklch(0.78 0.16 184 / 0.45), transparent 70%)" }}
          />
          <div
            className="absolute -bottom-16 left-1/4 size-64 animate-aurora rounded-full opacity-35 blur-[100px]"
            style={{
              background: "radial-gradient(circle, oklch(0.7 0.22 350 / 0.4), transparent 70%)",
              animationDelay: "-7s",
            }}
          />
          <div
            className="absolute -left-10 top-1/2 size-52 animate-aurora rounded-full opacity-25 blur-[80px]"
            style={{
              background: "radial-gradient(circle, oklch(0.66 0.2 295 / 0.4), transparent 70%)",
              animationDelay: "-12s",
            }}
          />
        </div>

        {/* top gradient accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="absolute inset-x-0 top-1 h-[1px] bg-gradient-to-r from-transparent via-fuchsia-500/30 to-transparent" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {/* avatar */}
            <div className="relative">
              <div className="aurora-border size-16 overflow-hidden rounded-2xl ring-2 ring-primary/30 ring-offset-2 ring-offset-background shadow-pop sm:size-20">
                <span className="aurora-border-ring" />
                {agent?.profile_picture_url ? (
                  <SecureImage
                    path={agent.profile_picture_url}
                    alt={agent.full_name}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/30 via-cyan-500/20 to-fuchsia-500/20">
                    <span className="text-2xl font-bold text-primary/90">
                      {initials(profile?.full_name ?? profile?.email)}
                    </span>
                  </div>
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-background bg-success">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-status-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-background" />
                </span>
              </span>
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80">
                <GreetIcon className="size-3.5 text-primary" />
                {greeting.label}
              </p>
              <h1 className="font-display mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
                <span className="text-gradient-aurora">{profile?.full_name?.split(" ")[0] ?? "Agent"}</span>
              </h1>
              {agent && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground/70">
                  <span className="flex items-center gap-1">
                    <Hash className="size-3 text-primary/60" />
                    <span className="font-mono">{agent.employee_id}</span>
                  </span>
                  {agent.designations?.name && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="size-3 text-primary/60" />
                      {agent.designations.name}
                    </span>
                  )}
                  {agent.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3 text-primary/60" />
                      {agent.city}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* date badge */}
          <div className="aurora-border flex shrink-0 flex-col items-start rounded-2xl bg-background/40 px-4 py-3 backdrop-blur-sm sm:items-end">
            <span className="aurora-border-ring" />
            <p className="relative text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Today</p>
            <p className="relative mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground/90">
              {new Date().toLocaleDateString("en-PK", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* ── TODAY'S ATTENDANCE ── */}
      <div className="animate-rise">
        <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/70">
          <span className="h-px w-6 bg-primary/30" />
          Today's Status
          <span className="h-px flex-1 bg-primary/10" />
        </h2>

        {/* shift info banner (only if agent has a parseable shift) */}
        {agent?.shift_timing && (() => {
          const shift = parseShift(agent.shift_timing);
          if (shift.flexible || !shift.startHM || !shift.endHM) return null;
          return (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-info/15 bg-info/5 px-3 py-2 text-xs">
              <CalendarClock className="size-3.5 text-info" />
              <span className="text-muted-foreground/80">Shift:</span>
              <span className="font-medium text-info">{shift.label}</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="font-mono font-semibold tabular-nums">
                {prettyHM(shift.startHM)} → {prettyHM(shift.endHM)}
              </span>
              {shift.crossesMidnight && (
                <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-400 ring-1 ring-violet-500/30">
                  crosses midnight
                </span>
              )}
              <span className="ml-auto text-muted-foreground/60">
                {autoClockOutLabel(agent.shift_timing)}
              </span>
            </div>
          );
        })()}

        {todayRecord ? (
          <div
            className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 ${STATUS_BG[todayRecord.status] ?? "from-secondary/30 to-secondary/10 border-border/30"}`}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current/30 to-transparent" />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {(() => {
                  const s = STATUS_ICON[todayRecord.status] ?? STATUS_ICON["present"]!;
                  const SIcon = s.icon;
                  return (
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-black/20 ring-1 ring-white/10">
                      <SIcon className={`size-7 ${s.color}`} />
                    </div>
                  );
                })()}
                <div>
                  <StatusBadge value={todayRecord.status} />
                  <p className="mt-1 text-lg font-bold capitalize text-foreground/90">
                    {todayRecord.status === "half_day" ? "Half Day" : todayRecord.status}
                  </p>
                  {todayRecord.notes && (
                    <p className="mt-0.5 text-xs text-muted-foreground/70 italic">
                      "{todayRecord.notes}"
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="grid grid-cols-3 gap-3 sm:gap-6">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
                      Clock In
                    </p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-foreground/80 sm:text-xl">
                      {formatTime(todayRecord.clock_in)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
                      Clock Out
                    </p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-foreground/80 sm:text-xl">
                      {todayRecord.clock_out ? formatTime(todayRecord.clock_out) : "—"}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
                      Hours
                    </p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-primary sm:text-xl">
                      {todayRecord.clock_in && !todayRecord.clock_out
                        ? (() => {
                            const elapsed = (now - new Date(todayRecord.clock_in).getTime()) / 3_600_000;
                            return `${elapsed.toFixed(2)} h`;
                          })()
                        : hoursLabel(todayRecord.total_hours)}
                    </p>
                  </div>
                </div>

                {/* live timer + clock-out button — only if not yet clocked out */}
                {!todayRecord.clock_out && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {agent?.shift_timing && (() => {
                      const exp = expectedClockOut(todayRecord.clock_in!, agent.shift_timing);
                      if (!exp) return null;
                      const remainingMs = exp.getTime() - now;
                      if (remainingMs <= 0) return null;
                      const h = Math.floor(remainingMs / 3_600_000);
                      const m = Math.floor((remainingMs % 3_600_000) / 60_000);
                      const s = Math.floor((remainingMs % 60_000) / 1000);
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary ring-1 ring-primary/20">
                          <Timer className="size-3 animate-pulse" />
                          <span className="font-mono tabular-nums">
                            {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
                          </span>
                          <span className="hidden text-primary/70 min-[380px]:inline">to auto clock-out</span>
                        </span>
                      );
                    })()}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                      disabled={updateAtt.isPending}
                      onClick={() => handleClockOut(todayRecord.id)}
                    >
                      <Moon className="size-3.5" />
                      {updateAtt.isPending ? "Clocking out…" : "Clock Out"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-border/40 bg-secondary/15 p-5 sm:flex-row sm:items-center">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary/50 ring-1 ring-border/30">
              <Clock className="size-5 text-muted-foreground/50" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground/70">Not clocked in yet</p>
              <p className="text-sm text-muted-foreground/60">
                {agent?.shift_timing
                  ? `Tap Clock In to start your workday. ${autoClockOutLabel(agent.shift_timing) ?? ""}`
                  : "Tap Clock In to start your workday."}
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0"
              disabled={insertAtt.isPending || checkingNetwork || !agent}
              onClick={handleClockIn}
            >
              <Sun className="size-3.5" />
              {checkingNetwork ? "Checking network…" : insertAtt.isPending ? "Clocking in…" : "Clock In"}
            </Button>
          </div>
        )}
      </div>

      {/* ── THIS MONTH STATS ── */}
      <div className="animate-rise">
        <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/70">
          <span className="h-px w-6 bg-primary/30" />
          This Month
          <span className="h-px flex-1 bg-primary/10" />
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Days Present",
              value: monthPresent,
              icon: CheckCircle2,
              color: "text-emerald-400",
              bg: "bg-emerald-500/10",
              ring: "ring-emerald-500/20",
            },
            {
              label: "Hours Worked",
              value: `${monthHours.toFixed(0)}h`,
              icon: Clock,
              color: "text-primary",
              bg: "bg-primary/10",
              ring: "ring-primary/20",
            },
            {
              label: "Absences",
              value: monthHistory.filter((r) => r.status === "absent").length,
              icon: XCircle,
              color: "text-red-400",
              bg: "bg-red-500/10",
              ring: "ring-red-500/20",
            },
            {
              label: "Late Arrivals",
              value: monthHistory.filter((r) => r.status === "late").length,
              icon: AlertCircle,
              color: "text-amber-400",
              bg: "bg-amber-500/10",
              ring: "ring-amber-500/20",
            },
          ].map((s) => (
            <div key={s.label} className="glass flex items-center gap-3.5 rounded-2xl px-4 py-4">
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${s.bg} ${s.ring}`}
              >
                <s.icon className={`size-4.5 ${s.color}`} />
              </span>
              <div>
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/60">
                  {s.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SALARY + QUICK STATS ROW ── */}
      {agent && (
        <div className="animate-rise grid gap-4 sm:grid-cols-2">
          {/* Salary card */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
            <div className="absolute -right-8 -top-8 size-32 rounded-full bg-primary/8 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary/60">
                <Banknote className="size-3.5" /> Monthly Salary
              </div>
              <p className="mt-3 text-4xl font-extrabold tracking-tight text-primary">
                {formatPKR(agent.salary)}
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground/60">
                {agent.bank_name
                  ? `${agent.bank_name} · ****${(agent.account_number ?? "").slice(-4)}`
                  : "Bank details not set"}
              </p>
            </div>
          </div>

          {/* 90-day summary */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              <TrendingUp className="size-3.5 text-primary/60" /> Last 90 Days
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {[
                { label: "Present", value: counts["present"] ?? 0, color: "text-emerald-400" },
                { label: "Absent", value: counts["absent"] ?? 0, color: "text-red-400" },
                { label: "Late", value: counts["late"] ?? 0, color: "text-amber-400" },
                { label: "Leave", value: counts["leave"] ?? 0, color: "text-violet-400" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2"
                >
                  <span className="text-[11px] text-muted-foreground/70">{s.label}</span>
                  <span className={`font-bold tabular-nums ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5">
              <span className="text-xs font-medium text-muted-foreground/70">Total Hours</span>
              <span className="font-mono font-bold tabular-nums text-primary">
                {totalHours.toFixed(1)}h
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── RECENT ATTENDANCE ── */}
      {history.length > 0 && (
        <div className="animate-rise">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/70">
              <span className="h-px w-6 bg-primary/30" />
              Recent Activity
            </h2>
            <Button variant="outline" size="sm" asChild className="h-7 rounded-lg px-3 text-xs">
              <Link to="/my-profile">
                View All <ArrowRight className="ml-1 size-3" />
              </Link>
            </Button>
          </div>
          <div className="glass overflow-hidden rounded-2xl">
            <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <ul className="divide-y divide-border/20">
              {history.slice(0, 6).map((r) => {
                const si = STATUS_ICON[r.status];
                const SIcon = si?.icon ?? Clock;
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-secondary/20"
                  >
                    <SIcon className={`size-4 shrink-0 ${si?.color ?? "text-muted-foreground"}`} />
                    <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground/70">
                      {formatDate(r.date)}
                    </span>
                    <span className="flex-1">
                      <StatusBadge value={r.status} />
                    </span>
                    <span className="hidden font-mono text-xs text-muted-foreground sm:block">
                      {formatTime(r.clock_in)}
                    </span>
                    <span className="hidden font-mono text-xs text-muted-foreground sm:block">
                      {formatTime(r.clock_out)}
                    </span>
                    <span className="font-mono text-xs font-semibold tabular-nums text-primary">
                      {hoursLabel(r.total_hours)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* ── QUICK LINKS ── */}
      <div className="animate-rise glass rounded-2xl p-5">
        <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/70">
          <Zap className="size-3.5" /> Quick Access
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/my-profile">My Profile</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/my-profile">My Attendance</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/my-profile">My Salary</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/my-profile">My Documents</Link>
          </Button>
          <Button asChild size="sm" className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20">
            <Link to="/reports">
              <BarChart3 className="size-3.5" /> My Reports
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Staff / Admin dashboard ───────────────────────────────────────────────────

// ── inline SVG chart primitives (no chart lib needed) ──────────────────────

/** Donut chart — single ring with multiple segments. */
function DonutChart({
  segments,
  size = 160,
  stroke = 18,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  stroke?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * circ;
          const dash = `${len} ${circ - len}`;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.22,1,0.36,1)" }}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      {(centerLabel || centerSub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && (
            <span className="font-mono text-2xl font-extrabold tabular-nums">{centerLabel}</span>
          )}
          {centerSub && <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{centerSub}</span>}
        </div>
      )}
    </div>
  );
}

/** Sparkline / area chart — smooth path under a curve. */
function AreaChart({
  data,
  width = 320,
  height = 80,
  color = "oklch(0.76 0.15 178)",
  fill = "oklch(0.76 0.15 178 / 0.18)",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = width / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return [x, y] as const;
  });
  // smooth path using simple Catmull-Rom-ish curve
  let path = `M ${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1]!;
    const [x2, y2] = pts[i]!;
    const cx = (x1 + x2) / 2;
    path += ` Q ${cx} ${y1} ${cx} ${(y1 + y2) / 2} T ${x2} ${y2}`;
  }
  const areaPath = `${path} L ${pts[pts.length - 1]![0]} ${height} L ${pts[0]![0]} ${height} Z`;
  const gradId = `area-grad-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity="0.5" />
          <stop offset="100%" stopColor={fill} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* end dot */}
      <circle cx={pts[pts.length - 1]![0]} cy={pts[pts.length - 1]![1]} r="3" fill={color} />
      <circle cx={pts[pts.length - 1]![0]} cy={pts[pts.length - 1]![1]} r="6" fill={color} opacity="0.25" />
    </svg>
  );
}

/** Horizontal bar — single bar with a value and a max. */
function MiniBar({
  value,
  max,
  color = "oklch(0.76 0.15 178)",
  track = "oklch(1 0 0 / 0.06)",
  height = 6,
}: {
  value: number;
  max: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height, background: track }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
      />
    </div>
  );
}

// ── helpers for charts ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  present: "oklch(0.72 0.16 155)",
  absent: "oklch(0.63 0.2 22)",
  late: "oklch(0.79 0.15 78)",
  half_day: "oklch(0.7 0.13 235)",
  leave: "oklch(0.65 0.18 300)",
  holiday: "oklch(0.75 0.13 200)",
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function last7Days() {
  const out: { label: string; iso: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({
      label: d.toLocaleDateString("en-PK", { weekday: "short" }).slice(0, 3),
      iso: d.toISOString().slice(0, 10),
    });
  }
  return out;
}

// ── main staff dashboard ────────────────────────────────────────────────────

function StaffDashboard() {
  const { profile } = useAuth();
  const today = todayISO();
  const { data: agents = [] } = useAgents();
  const { data: attendance } = useAttendance(today);

  // last 7 days for the trend area chart
  const seven = useMemo(() => last7Days(), []);
  const rangeFrom = seven[0]!.iso;
  const rangeTo = seven[6]!.iso;
  const { data: range = [] } = useAttendanceRange(rangeFrom, rangeTo);

  // cross-month reports
  const { data: reports = [] } = useAllReports();
  // office expenses (current month)
  const currentMonth = monthKey(new Date());
  const { data: expenses = [] } = useExpenses(currentMonth);
  // attendance violations
  const { data: violations = [] } = useAttendanceViolations();
  // network settings (just for the count)
  const { data: networks = [] } = useNetworkSettings();

  // ── derive chart data ──────────────────────────────────────────────────────
  const rows = attendance ?? [];
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === "active").length;

  // today's status mix (for donut)
  const statusSegments = [
    { value: count("present"), color: STATUS_COLORS.present!, label: "Present" },
    { value: count("late"), color: STATUS_COLORS.late!, label: "Late" },
    { value: count("absent"), color: STATUS_COLORS.absent!, label: "Absent" },
    { value: count("leave"), color: STATUS_COLORS.leave!, label: "Leave" },
    { value: count("half_day"), color: STATUS_COLORS.half_day!, label: "Half Day" },
    { value: count("holiday"), color: STATUS_COLORS.holiday!, label: "Holiday" },
  ].filter((s) => s.value > 0);

  // 7-day trend (present count per day)
  const trendData = seven.map((d) => range.filter((r) => r.date === d.iso && r.status === "present").length);
  const trendMax = Math.max(...trendData, 1);

  // 7-day total hours trend (for the area chart secondary metric)
  const hoursTrend = seven.map((d) =>
    range.filter((r) => r.date === d.iso).reduce((s, r) => s + (r.total_hours ?? 0), 0),
  );

  // top performers (by overall_score from reports)
  const topPerformers = [...reports].sort((a, b) => b.overall_score - a.overall_score).slice(0, 5);

  // expenses summary
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const expensesByCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    const cat = e.category || "Other";
    acc[cat] = (acc[cat] ?? 0) + Number(e.amount);
    return acc;
  }, {});
  const expenseCategories = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxCatAmount = Math.max(...expenseCategories.map(([, v]) => v), 1);

  // pending approvals & violations
  const pendingViolations = violations.length;
  const enabledNetworks = networks.filter((n) => n.enabled).length;

  // attendance rate
  const attendanceRate = totalAgents
    ? Math.round((count("present") / totalAgents) * 100)
    : 0;

  // total hours worked today
  const totalHoursToday = rows.reduce((s, r) => s + (r.total_hours ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* ── HERO HEADER ──────────────────────────────────────────────────────── */}
      <div className="aurora-border glass-strong animate-rise relative overflow-hidden rounded-3xl p-5 sm:p-7">
        <span className="aurora-border-ring" />
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -right-20 -top-24 size-80 animate-aurora rounded-full opacity-50 blur-[100px]"
            style={{ background: "radial-gradient(circle, oklch(0.78 0.16 184 / 0.45), transparent 70%)" }}
          />
          <div
            className="absolute -bottom-16 left-1/4 size-64 animate-aurora rounded-full opacity-35 blur-[100px]"
            style={{
              background: "radial-gradient(circle, oklch(0.7 0.22 350 / 0.4), transparent 70%)",
              animationDelay: "-7s",
            }}
          />
          <div
            className="absolute -left-10 top-1/2 size-52 animate-aurora rounded-full opacity-25 blur-[80px]"
            style={{
              background: "radial-gradient(circle, oklch(0.66 0.2 295 / 0.4), transparent 70%)",
              animationDelay: "-12s",
            }}
          />
        </div>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="absolute inset-x-0 top-1 h-[1px] bg-gradient-to-r from-transparent via-fuchsia-500/30 to-transparent" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="aurora-border relative grid size-11 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
              <span className="aurora-border-ring" />
              <Sparkles className="relative size-5 text-primary" strokeWidth={2.2} />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80">
                <Activity className="size-3.5 text-primary" /> Live snapshot
              </p>
              <h1 className="font-display mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">
                <span className="text-gradient-aurora">Welcome back, {profile?.full_name?.split(" ")[0] ?? "there"}</span>
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground/70">
                {new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* attendance rate ring */}
          <div className="aurora-border flex items-center gap-4 rounded-2xl bg-background/40 px-4 py-3 backdrop-blur-sm">
            <span className="aurora-border-ring" />
            <DonutChart
              segments={[
                { value: attendanceRate, color: "oklch(0.78 0.16 184)", label: "Present" },
                { value: 100 - attendanceRate, color: "oklch(1 0 0 / 0.08)", label: "Rest" },
              ]}
              size={64}
              stroke={7}
            />
            <div className="relative">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Attendance Rate</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-primary">
                {attendanceRate}<span className="text-sm text-muted-foreground/60">%</span>
              </p>
              <p className="text-[10px] text-muted-foreground/60">{count("present")} of {totalAgents} today</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI STAT GRID ────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Agents" value={totalAgents} icon={Users} hint={`${activeAgents} active`} delay={0} />
        <StatCard label="Present Today" value={count("present")} icon={UserCheck} tone="success" delay={60} />
        <StatCard label="Absent Today" value={count("absent")} icon={UserX} tone="destructive" delay={120} />
        <StatCard label="Late Today" value={count("late")} icon={Clock} tone="warning" delay={180} />
        <StatCard label="On Leave" value={count("leave")} icon={PlaneTakeoff} tone="info" delay={240} />
      </section>

      {/* ── CHARTS ROW 1 (donut + 7-day trend) ──────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Today's status donut */}
        <div className="glass animate-rise rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <PieChart className="size-4 text-primary" /> Today's Status Mix
              </h2>
              <p className="text-[11px] text-muted-foreground/60">Breakdown by attendance status</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <DonutChart
              segments={
                statusSegments.length
                  ? statusSegments
                  : [{ value: 1, color: "oklch(1 0 0 / 0.08)", label: "No data" }]
              }
              size={160}
              stroke={20}
              centerLabel={String(rows.length)}
              centerSub="records"
            />
            <div className="grid flex-1 grid-cols-2 gap-2">
              {statusSegments.map((s) => (
                <div key={s.label} className="flex items-center gap-2 rounded-lg bg-secondary/30 px-2.5 py-1.5">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 text-[11px] text-muted-foreground/80">{s.label}</span>
                  <span className="font-mono text-xs font-bold tabular-nums">{s.value}</span>
                </div>
              ))}
              {!statusSegments.length && (
                <p className="col-span-2 py-6 text-center text-xs text-muted-foreground/60">
                  No attendance recorded today.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 7-day attendance trend */}
        <div className="glass animate-rise rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <TrendingUp className="size-4 text-primary" /> 7-Day Attendance Trend
              </h2>
              <p className="text-[11px] text-muted-foreground/60">Present count over the last week</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-bold tabular-nums text-primary">
                {trendData.reduce((s, v) => s + v, 0)}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">total present</p>
            </div>
          </div>

          {/* area chart */}
          <div className="relative">
            <AreaChart data={trendData} height={100} />
            {/* x-axis labels */}
            <div className="mt-1 flex justify-between px-0.5">
              {seven.map((d) => (
                <span key={d.iso} className="text-[10px] font-medium text-muted-foreground/60">
                  {d.label}
                </span>
              ))}
            </div>
          </div>

          {/* mini stat row */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-secondary/30 p-2.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Peak</p>
              <p className="font-mono text-sm font-bold tabular-nums text-emerald-400">{trendMax}</p>
            </div>
            <div className="rounded-xl bg-secondary/30 p-2.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Avg</p>
              <p className="font-mono text-sm font-bold tabular-nums text-primary">
                {(trendData.reduce((s, v) => s + v, 0) / 7).toFixed(1)}
              </p>
            </div>
            <div className="rounded-xl bg-secondary/30 p-2.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Hours</p>
              <p className="font-mono text-sm font-bold tabular-nums text-info">
                {hoursTrend.reduce((s, v) => s + v, 0).toFixed(0)}h
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CHARTS ROW 2 (top performers + expenses) ────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Top performers */}
        <div className="glass animate-rise rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Trophy className="size-4 text-amber-400" /> Top Performers
              </h2>
              <p className="text-[11px] text-muted-foreground/60">Latest monthly report scores</p>
            </div>
            <Button variant="outline" size="sm" asChild className="h-7 rounded-lg px-2.5 text-xs">
              <Link to="/reports/manage">
                Manage <ArrowRight className="ml-1 size-3" />
              </Link>
            </Button>
          </div>

          {!topPerformers.length ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-secondary/40 ring-1 ring-border">
                <Trophy className="size-5 text-muted-foreground/60" />
              </div>
              <p className="text-xs text-muted-foreground/70">No reports published yet.</p>
              <Button asChild size="sm" variant="outline" className="mt-1 h-7 text-xs">
                <Link to="/reports/manage">Create first report</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {topPerformers.map((r, i) => {
                const maxScore = 100;
                const tone =
                  r.overall_score >= 85 ? "oklch(0.72 0.16 155)" :
                  r.overall_score >= 70 ? "oklch(0.7 0.13 235)" :
                  r.overall_score >= 50 ? "oklch(0.79 0.15 78)" :
                  "oklch(0.63 0.2 22)";
                return (
                  <li
                    key={r.id}
                    className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 transition-all hover:border-primary/20 hover:bg-white/[0.06]"
                  >
                    <span className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold",
                      i === 0 ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30" :
                      i === 1 ? "bg-slate-400/20 text-slate-300 ring-1 ring-slate-400/30" :
                      i === 2 ? "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30" :
                      "bg-secondary/40 text-muted-foreground",
                    )}>
                      {i + 1}
                    </span>
                    <div className="size-8 shrink-0 overflow-hidden rounded-lg ring-1 ring-border/40">
                      {r.agents?.profile_picture_url ? (
                        <SecureImage path={r.agents.profile_picture_url} alt={r.agents.full_name} className="size-full object-cover" />
                      ) : (
                        <div className="grid size-full place-items-center bg-primary/15 text-[10px] font-bold text-primary">
                          {initials(r.agents?.full_name)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{r.agents?.full_name ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {new Date(r.month).toLocaleDateString("en-PK", { month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="w-16 shrink-0">
                      <MiniBar value={r.overall_score} max={maxScore} color={tone} height={5} />
                    </div>
                    <span className="w-10 shrink-0 text-right font-mono text-sm font-bold tabular-nums" style={{ color: tone }}>
                      {r.overall_score.toFixed(0)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Office expenses breakdown */}
        <div className="glass animate-rise rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Receipt className="size-4 text-info" /> Office Expenses
              </h2>
              <p className="text-[11px] text-muted-foreground/60">
                {new Date().toLocaleDateString("en-PK", { month: "long", year: "numeric" })}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild className="h-7 rounded-lg px-2.5 text-xs">
              <Link to="/expenses">
                Manage <ArrowRight className="ml-1 size-3" />
              </Link>
            </Button>
          </div>

          {/* total */}
          <div className="mb-4 flex items-end justify-between rounded-xl border border-info/15 bg-info/5 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-info/70">Total Spent</p>
              <p className="font-mono text-2xl font-extrabold tabular-nums text-info">{formatPKR(totalExpenses)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Entries</p>
              <p className="font-mono text-sm font-bold tabular-nums">{expenses.length}</p>
            </div>
          </div>

          {/* category bars */}
          {expenseCategories.length ? (
            <ul className="space-y-2">
              {expenseCategories.map(([cat, amount]) => {
                const pct = maxCatAmount ? (amount / maxCatAmount) * 100 : 0;
                return (
                  <li key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground/80">{labelize(cat)}</span>
                      <span className="font-mono font-semibold tabular-nums text-info">{formatPKR(amount)}</span>
                    </div>
                    <MiniBar value={amount} max={maxCatAmount} color="oklch(0.7 0.13 235)" height={5} />
                    <span className="text-[9px] text-muted-foreground/50">{pct.toFixed(0)}% of top</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-secondary/40 ring-1 ring-border">
                <Receipt className="size-5 text-muted-foreground/60" />
              </div>
              <p className="text-xs text-muted-foreground/70">No expenses recorded this month.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── ROW 3: System status + Quick actions ───────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* System health */}
        <div className="glass animate-rise rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <ShieldAlert className="size-4 text-amber-400" /> System Health
          </h2>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2">
              <span className="flex items-center gap-2 text-xs">
                <Wifi className="size-3.5 text-primary" /> Office Networks
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-primary">{enabledNetworks}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2">
              <span className="flex items-center gap-2 text-xs">
                <ShieldAlert className="size-3.5 text-amber-400" /> Attendance Violations
              </span>
              <span className={cn(
                "font-mono text-sm font-bold tabular-nums",
                pendingViolations > 0 ? "text-amber-400" : "text-emerald-400",
              )}>{pendingViolations}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2">
              <span className="flex items-center gap-2 text-xs">
                <Clock className="size-3.5 text-info" /> Hours Worked Today
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-info">{totalHoursToday.toFixed(0)}h</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2">
              <span className="flex items-center gap-2 text-xs">
                <Wallet className="size-3.5 text-emerald-400" /> Active Agents
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-emerald-400">{activeAgents}</span>
            </div>
          </div>
        </div>

        {/* Today's activity */}
        <div className="glass animate-rise rounded-2xl p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Activity className="size-4 text-primary" /> Today&apos;s Activity
            </h2>
            <Button variant="outline" size="sm" asChild className="h-7 rounded-lg px-2.5 text-xs">
              <Link to="/attendance">
                Full view <ArrowRight className="ml-1 size-3" />
              </Link>
            </Button>
          </div>
          {!rows.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No attendance recorded yet today.
            </p>
          ) : (
            <ul className="divide-y divide-border/30">
              {rows.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <div className="size-7 shrink-0 overflow-hidden rounded-lg ring-1 ring-border/40">
                    {r.agents?.profile_picture_url ? (
                      <SecureImage path={r.agents.profile_picture_url} alt={r.agents.full_name} className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center bg-primary/15 text-[9px] font-bold text-primary">
                        {initials(r.agents?.full_name)}
                      </div>
                    )}
                  </div>
                  <span className="flex-1 truncate text-xs font-medium">{r.agents?.full_name ?? "—"}</span>
                  <span className="hidden w-16 font-mono text-[10px] text-muted-foreground sm:block">
                    {formatTime(r.clock_in)}
                  </span>
                  <span className="hidden w-16 font-mono text-[10px] text-muted-foreground sm:block">
                    {formatTime(r.clock_out)}
                  </span>
                  <span className="hidden w-12 font-mono text-[10px] tabular-nums text-muted-foreground sm:block">
                    {hoursLabel(r.total_hours)}
                  </span>
                  <StatusBadge value={r.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Quick actions ──────────────────────────────────────────────────── */}
      <section className="glass animate-rise rounded-2xl p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <Zap className="size-4 text-primary" /> Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <QuickAction to="/agents/new" icon={Users} label="Add Agent" tone="primary" />
          <QuickAction to="/agents" icon={Briefcase} label="Manage Agents" tone="info" />
          <QuickAction to="/attendance" icon={CalendarCheck} label="Attendance" tone="success" />
          <QuickAction to="/expenses" icon={Receipt} label="Expenses" tone="warning" />
          <QuickAction to="/reports/manage" icon={BarChart3} label="Reports" tone="destructive" />
        </div>
      </section>
    </div>
  );
}

// ── QuickAction tile ─────────────────────────────────────────────────────────

function QuickAction({
  to,
  icon: Icon,
  label,
  tone,
}: {
  to: string;
  icon: typeof Users;
  label: string;
  tone: "primary" | "success" | "warning" | "destructive" | "info";
}) {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary/10 ring-primary/20 hover:bg-primary/20",
    success: "text-success bg-success/10 ring-success/20 hover:bg-success/20",
    warning: "text-warning bg-warning/10 ring-warning/20 hover:bg-warning/20",
    destructive: "text-destructive bg-destructive/10 ring-destructive/20 hover:bg-destructive/20",
    info: "text-info bg-info/10 ring-info/20 hover:bg-info/20",
  };
  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-2 rounded-2xl border border-border/40 bg-secondary/15 p-4 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 active:scale-95"
    >
      <span className={cn("grid size-10 place-items-center rounded-xl ring-1 transition-transform group-hover:scale-110", tones[tone])}>
        <Icon className="size-5" />
      </span>
      <span className="text-xs font-medium text-foreground/80">{label}</span>
    </Link>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

function Dashboard() {
  const { isAgentOnly } = useAuth();
  return isAgentOnly ? <AgentDashboard /> : <StaffDashboard />;
}
