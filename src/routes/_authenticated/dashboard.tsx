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
  Banknote,
  TrendingUp,
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
} from "lucide-react";

import { StatCard } from "@/components/billzo/StatCard";
import { StatusBadge } from "@/components/billzo/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  useAgents, useAttendance, useAgentAttendanceHistory, useMyAgent,
  useInsertAttendance, useUpdateAttendance,
  useNetworkSettings, useLogAttendanceViolation,
} from "@/lib/queries";
import { formatDate, formatPKR, formatTime, hoursLabel, todayISO, initials } from "@/lib/billzo";
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
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── GREETING HERO ── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br from-[#0d1420] via-[#0f1827] to-[#090e18] p-6 sm:p-8 shadow-2xl shadow-black/40 animate-rise">
        {/* background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 size-72 rounded-full bg-primary/8 blur-3xl" />
          <div className="absolute -bottom-10 left-1/3 size-56 rounded-full bg-indigo-500/6 blur-3xl" />
          <div className="absolute top-0 left-0 size-40 rounded-full bg-violet-500/5 blur-2xl" />
        </div>

        {/* top accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="absolute inset-x-0 top-1 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {/* avatar */}
            <div className="relative">
              <div className="size-16 overflow-hidden rounded-2xl ring-2 ring-primary/30 ring-offset-2 ring-offset-[#0d1420] shadow-xl sm:size-20">
                {agent?.profile_picture_url ? (
                  <SecureImage
                    path={agent.profile_picture_url}
                    alt={agent.full_name}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/30 to-indigo-500/20">
                    <span className="text-2xl font-bold text-primary/90">
                      {initials(profile?.full_name ?? profile?.email)}
                    </span>
                  </div>
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full border-2 border-[#0d1420] bg-emerald-500">
                <span className="size-1.5 animate-pulse rounded-full bg-white/80" />
              </span>
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70">
                <GreetIcon className="size-3.5" />
                {greeting.label}
              </p>
              <h1 className="mt-0.5 bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
                {profile?.full_name?.split(" ")[0] ?? "Agent"}
              </h1>
              {agent && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/40">
                  <span className="flex items-center gap-1">
                    <Hash className="size-3 text-primary/60" />
                    {agent.employee_id}
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
          <div className="flex shrink-0 flex-col items-start rounded-2xl border border-white/8 bg-white/3 px-4 py-3 sm:items-end">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Today</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground/80">
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
                <div className="flex gap-4 sm:gap-6">
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
                  <div className="flex items-center gap-2">
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
                          <span className="text-primary/70">to auto clock-out</span>
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

function StaffDashboard() {
  const { profile } = useAuth();
  const today = todayISO();
  const { data: agents } = useAgents();
  const { data: attendance } = useAttendance(today);

  const rows = attendance ?? [];
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const total = agents?.length ?? 0;

  return (
    <div className="space-y-6">
      <header className="animate-rise">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          Welcome back, <span className="text-gradient">{profile?.full_name ?? "there"}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live snapshot for {new Date().toLocaleDateString("en-PK", { dateStyle: "full" })}.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Agents" value={total} icon={Users} delay={0} />
        <StatCard
          label="Present Today"
          value={count("present")}
          icon={UserCheck}
          tone="success"
          delay={60}
        />
        <StatCard
          label="Absent Today"
          value={count("absent")}
          icon={UserX}
          tone="destructive"
          delay={120}
        />
        <StatCard
          label="Late Today"
          value={count("late")}
          icon={Clock}
          tone="warning"
          delay={180}
        />
        <StatCard
          label="On Leave"
          value={count("leave")}
          icon={PlaneTakeoff}
          tone="info"
          delay={240}
        />
      </section>

      <section className="glass animate-rise rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Today&apos;s Activity</h2>
          <Button variant="outline" size="sm" asChild>
            <Link to="/attendance">
              Full Attendance <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        {!rows.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No attendance recorded yet today.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {rows.slice(0, 8).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-3 text-sm">
                <span className="flex-1 truncate font-medium">{r.agents?.full_name ?? "—"}</span>
                <span className="hidden w-28 text-muted-foreground sm:block">
                  {r.agents?.employee_id}
                </span>
                <span className="w-20 text-muted-foreground">{formatTime(r.clock_in)}</span>
                <span className="w-20 text-muted-foreground">{formatTime(r.clock_out)}</span>
                <span className="hidden w-20 tabular-nums text-muted-foreground sm:block">
                  {hoursLabel(r.total_hours)}
                </span>
                <StatusBadge value={r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass animate-rise rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/agents/new">Add New Agent</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/agents">Manage Agents</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/attendance">Attendance Dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/expenses">Office Expenses</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/reports/manage">
              <BarChart3 className="size-4" /> Manage Reports
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

function Dashboard() {
  const { isAgentOnly } = useAuth();
  return isAgentOnly ? <AgentDashboard /> : <StaffDashboard />;
}
