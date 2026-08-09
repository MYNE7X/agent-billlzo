import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Star,
  Banknote,
  Target,
  Award,
  Smile,
  Clock,
  CalendarDays,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  Trophy,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useMyAgent, useAgentReports, type MonthlyReportWithAgent } from "@/lib/queries";
import { formatPKR, formatDate, initials } from "@/lib/billzo";
import { SecureImage } from "@/components/billzo/SecureImage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports/")({
  component: ReportsPage,
});

// ── helpers ───────────────────────────────────────────────────────────────

const SENTIMENT_META: Record<
  MonthlyReportWithAgent["sentiment"],
  { icon: typeof Star; tone: string; ring: string; bg: string; label: string }
> = {
  praise: {
    icon: Trophy,
    tone: "text-emerald-400",
    ring: "ring-emerald-500/30",
    bg: "from-emerald-500/15 to-emerald-500/5",
    label: "Praise",
  },
  improvement: {
    icon: Sparkles,
    tone: "text-blue-400",
    ring: "ring-blue-500/30",
    bg: "from-blue-500/15 to-blue-500/5",
    label: "Needs Improvement",
  },
  warning: {
    icon: AlertTriangle,
    tone: "text-amber-400",
    ring: "ring-amber-500/30",
    bg: "from-amber-500/15 to-amber-500/5",
    label: "Warning",
  },
  neutral: {
    icon: Info,
    tone: "text-muted-foreground",
    ring: "ring-border/40",
    bg: "from-secondary/30 to-secondary/10",
    label: "Neutral",
  },
};

function scoreTone(score: number) {
  if (score >= 85) return { color: "text-emerald-400", label: "Excellent", ring: "ring-emerald-500/40", stroke: "oklch(0.72 0.16 155)" };
  if (score >= 70) return { color: "text-blue-400", label: "Good", ring: "ring-blue-500/40", stroke: "oklch(0.7 0.13 235)" };
  if (score >= 50) return { color: "text-amber-400", label: "Average", ring: "ring-amber-500/40", stroke: "oklch(0.79 0.15 78)" };
  return { color: "text-red-400", label: "Needs Work", ring: "ring-red-500/40", stroke: "oklch(0.63 0.2 22)" };
}

function pctOf(value: number, target: number) {
  if (!target) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

function monthLabel(month: string) {
  return new Date(month).toLocaleDateString("en-PK", { year: "numeric", month: "long" });
}

function monthShort(month: string) {
  return new Date(month).toLocaleDateString("en-PK", { year: "2-digit", month: "short" });
}

// ── circular progress ─────────────────────────────────────────────────────

function CircularProgress({
  value,
  size = 96,
  stroke = 8,
  color,
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  label?: string;
  sublabel?: string;
}) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (Math.min(100, Math.max(0, value)) / 100) * circ;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(1 0 0 / 0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-bold tabular-nums">{Math.round(value)}</span>
        {label && <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70">{label}</span>}
        {sublabel && <span className="text-[10px] font-medium" style={{ color }}>{sublabel}</span>}
      </div>
    </div>
  );
}

// ── score bar ─────────────────────────────────────────────────────────────

function ScoreBar({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Star }) {
  const tone = scoreTone(value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground/80">
          <Icon className={cn("size-3.5", tone.color)} />
          {label}
        </span>
        <span className={cn("font-mono font-semibold tabular-nums", tone.color)}>
          {value.toFixed(0)}<span className="text-[10px] text-muted-foreground/60">/100</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary/40">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(100, value)}%`,
            background: `linear-gradient(90deg, ${tone.stroke}, ${tone.stroke}99)`,
          }}
        />
      </div>
    </div>
  );
}

// ── diff pill ─────────────────────────────────────────────────────────────

function DiffPill({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
        <ArrowUpRight className="size-3" /> +{value.toFixed(0)}
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400 ring-1 ring-red-500/20">
        <ArrowDownRight className="size-3" /> {value.toFixed(0)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border">
      <Minus className="size-3" /> 0
    </span>
  );
}

// ── report card ───────────────────────────────────────────────────────────

function ReportCard({ report, prev }: { report: MonthlyReportWithAgent; prev?: MonthlyReportWithAgent }) {
  const [expanded, setExpanded] = useState(false);
  const sentiment = SENTIMENT_META[report.sentiment];
  const SentimentIcon = sentiment.icon;
  const overallTone = scoreTone(report.overall_score);
  const achievementDiff = prev ? report.achievement_pct - prev.achievement_pct : 0;
  const overallDiff = prev ? report.overall_score - prev.overall_score : 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-gradient-to-br p-5 transition-all duration-300",
        "border-white/8 hover:border-white/15",
        sentiment.bg,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current/40 to-transparent" />

      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("grid size-11 shrink-0 place-items-center rounded-2xl bg-black/25 ring-1", sentiment.ring)}>
            <SentimentIcon className={cn("size-5", sentiment.tone)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold">{monthLabel(report.month)}</h3>
              <span className={cn("rounded-full border border-current/30 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider", sentiment.tone)}>
                {sentiment.label}
              </span>
            </div>
            {report.headline && (
              <p className="mt-0.5 text-xs text-muted-foreground/80 italic">"{report.headline}"</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <DiffPill value={overallDiff} />
          <span className="text-[10px] text-muted-foreground/60">vs last</span>
        </div>
      </div>

      {/* main grid */}
      <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/15 p-4 ring-1 ring-white/5">
          <CircularProgress
            value={report.overall_score}
            color={overallTone.stroke}
            sublabel={overallTone.label}
            label="Overall"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <ScoreBar label="Performance" value={report.performance_score} icon={Award} />
            <ScoreBar label="Behavior" value={report.behavior_score} icon={Smile} />
            <ScoreBar label="Attendance" value={report.attendance_score} icon={CheckCircle2} />
            <ScoreBar label="Punctuality" value={report.punctuality_score} icon={Clock} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-black/15 px-3 py-2 ring-1 ring-white/5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Present</p>
              <p className="font-mono text-sm font-bold text-emerald-400">{report.days_present}d</p>
            </div>
            <div className="rounded-xl bg-black/15 px-3 py-2 ring-1 ring-white/5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Late</p>
              <p className="font-mono text-sm font-bold text-amber-400">{report.days_late}d</p>
            </div>
            <div className="rounded-xl bg-black/15 px-3 py-2 ring-1 ring-white/5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Hours</p>
              <p className="font-mono text-sm font-bold text-primary">{Number(report.total_hours).toFixed(0)}h</p>
            </div>
          </div>
        </div>
      </div>

      {/* salary + sales row */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary/70">
            <Banknote className="size-3.5" /> Salary Breakdown
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Net</p>
              <p className="font-mono text-xl font-bold text-primary">{formatPKR(report.net_salary)}</p>
            </div>
            <div className="flex gap-3 text-right">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Base</p>
                <p className="font-mono text-xs font-semibold">{formatPKR(report.base_salary)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-emerald-400/70">Bonus</p>
                <p className="font-mono text-xs font-semibold text-emerald-400">+{formatPKR(report.bonus)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-red-400/70">Cut</p>
                <p className="font-mono text-xs font-semibold text-red-400">-{formatPKR(report.deduction)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-info/15 bg-info/5 p-4">
          <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-widest text-info/70">
            <span className="flex items-center gap-1.5">
              <Target className="size-3.5" /> Sales Performance
            </span>
            <DiffPill value={achievementDiff} />
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Achieved</p>
              <p className="font-mono text-xl font-bold text-info">{report.achievement_pct.toFixed(1)}%</p>
            </div>
            <div className="flex gap-3 text-right">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Sales</p>
                <p className="font-mono text-xs font-semibold">{formatPKR(report.total_sales)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Target</p>
                <p className="font-mono text-xs font-semibold">{formatPKR(report.sales_target)}</p>
              </div>
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary/40">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pctOf(report.total_sales, report.sales_target)}%`,
                background: "linear-gradient(90deg, oklch(0.7 0.13 235), oklch(0.76 0.15 178))",
              }}
            />
          </div>
        </div>
      </div>

      {/* notes (expandable) */}
      {report.notes && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/15 px-3 py-2 text-xs font-medium text-muted-foreground/80 transition-colors hover:bg-black/25"
          >
            <span className="flex items-center gap-1.5">
              <Info className="size-3.5" /> Admin Notes
            </span>
            <ChevronDown className={cn("size-3.5 transition-transform duration-200", expanded && "rotate-180")} />
          </button>
          {expanded && (
            <div className="mt-2 animate-rise rounded-xl border border-white/8 bg-black/15 p-3 text-sm leading-relaxed text-foreground/80">
              {report.notes}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground/50">
        <span>Generated {formatDate(report.created_at)}</span>
        {report.created_by && <span>by Admin</span>}
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────

function ReportsPage() {
  const { user, profile, isStaff } = useAuth();
  const navigate = useNavigate();
  const { data: agent, isLoading: agentLoading } = useMyAgent(user?.id);
  const { data: reports = [], isLoading: reportsLoading } = useAgentReports(agent?.id);

  // Staff without an agent profile should land on the manage page instead.
  useEffect(() => {
    if (isStaff && !agentLoading && !agent) {
      void navigate({ to: "/reports/manage" });
    }
  }, [isStaff, agentLoading, agent, navigate]);

  const summary = useMemo(() => {
    if (!reports.length) return null;
    const latest = reports[0]!;
    const prev = reports[1];
    const avgOverall = reports.reduce((s, r) => s + r.overall_score, 0) / reports.length;
    const totalSales = reports.reduce((s, r) => s + Number(r.total_sales), 0);
    const totalNet = reports.reduce((s, r) => s + Number(r.net_salary), 0);
    return { latest, prev, avgOverall, totalSales, totalNet, count: reports.length };
  }, [reports]);

  const months = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => set.add(r.month));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [reports]);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);

  const filtered = activeMonth ? reports.filter((r) => r.month === activeMonth) : reports;
  const loading = agentLoading || reportsLoading;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <div className="grid size-16 place-items-center rounded-2xl bg-secondary/40 ring-1 ring-border">
          <BarChart3 className="size-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">No agent profile linked</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your account is not yet linked to an agent record. Please ask an administrator to link your account.
        </p>
      </div>
    );
  }

  if (!reports.length) {
    return (
      <div className="space-y-6">
        <HeroHeader agent={agent} profileName={profile?.full_name ?? "Agent"} />
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-secondary/40 ring-1 ring-border">
            <BarChart3 className="size-7 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">No reports yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Monthly performance reports will appear here once your admin publishes them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HeroHeader agent={agent} profileName={profile?.full_name ?? "Agent"} />

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat
            label="Reports"
            value={String(summary.count)}
            icon={CalendarDays}
            color="text-primary"
            bg="bg-primary/10"
            ring="ring-primary/20"
          />
          <SummaryStat
            label="Avg Score"
            value={`${summary.avgOverall.toFixed(0)}`}
            icon={Trophy}
            color="text-emerald-400"
            bg="bg-emerald-500/10"
            ring="ring-emerald-500/20"
            suffix="/100"
          />
          <SummaryStat
            label="Total Sales"
            value={formatPKR(summary.totalSales)}
            icon={TrendingUp}
            color="text-info"
            bg="bg-info/10"
            ring="ring-info/20"
            compact
          />
          <SummaryStat
            label="Total Earned"
            value={formatPKR(summary.totalNet)}
            icon={Banknote}
            color="text-amber-400"
            bg="bg-amber-500/10"
            ring="ring-amber-500/20"
            compact
          />
        </div>
      )}

      {months.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveMonth(null)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              activeMonth === null
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {months.map((m) => (
            <button
              key={m}
              onClick={() => setActiveMonth(m)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                activeMonth === m
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground",
              )}
            >
              {monthShort(m)}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-5">
        {filtered.map((r, i) => {
          const prev = reports[i + 1];
          return <ReportCard key={r.id} report={r} prev={prev} />;
        })}
      </div>
    </div>
  );
}

function HeroHeader({
  agent,
  profileName,
}: {
  agent: NonNullable<ReturnType<typeof useMyAgent>["data"]>;
  profileName: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br from-[#0d1420] via-[#0f1827] to-[#090e18] p-6 sm:p-8 shadow-2xl shadow-black/40 animate-rise">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-20 size-72 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-10 left-1/3 size-56 rounded-full bg-indigo-500/6 blur-3xl" />
      </div>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="size-16 overflow-hidden rounded-2xl ring-2 ring-primary/30 ring-offset-2 ring-offset-[#0d1420] sm:size-20">
              {agent.profile_picture_url ? (
                <SecureImage path={agent.profile_picture_url} alt={agent.full_name} className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/30 to-indigo-500/20">
                  <span className="text-2xl font-bold text-primary/90">{initials(profileName)}</span>
                </div>
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border-2 border-[#0d1420] bg-primary">
              <BarChart3 className="size-3.5 text-background" />
            </span>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70">
              <Sparkles className="size-3.5" /> Performance Reports
            </p>
            <h1 className="mt-0.5 bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
              {profileName.split(" ")[0]}'s Report Card
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/40">
              <span>{agent.employee_id}</span>
              {agent.designations?.name && <span>· {agent.designations.name}</span>}
              {agent.departments?.name && <span>· {agent.departments.name}</span>}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start rounded-2xl border border-white/8 bg-white/3 px-4 py-3 sm:items-end">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Last Updated</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground/80">
            {new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "short" })}
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
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
  icon: typeof Star;
  color: string;
  bg: string;
  ring: string;
  suffix?: string;
  compact?: boolean;
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl px-3 py-3 sm:px-4 sm:py-4">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl ring-1 sm:size-10", bg, ring)}>
        <Icon className={cn("size-4 sm:size-4.5", color)} />
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
