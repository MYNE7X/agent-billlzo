import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
  delay = 0,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "destructive" | "info";
  hint?: string;
  delay?: number;
}) {
  const tones: Record<string, { ring: string; text: string; bg: string; glow: string }> = {
    primary: {
      ring: "ring-primary/30",
      text: "text-primary",
      bg: "bg-primary/15",
      glow: "oklch(0.78 0.16 184 / 0.35)",
    },
    success: {
      ring: "ring-success/30",
      text: "text-success",
      bg: "bg-success/15",
      glow: "oklch(0.74 0.16 156 / 0.35)",
    },
    warning: {
      ring: "ring-warning/30",
      text: "text-warning",
      bg: "bg-warning/15",
      glow: "oklch(0.81 0.15 78 / 0.35)",
    },
    destructive: {
      ring: "ring-destructive/30",
      text: "text-destructive",
      bg: "bg-destructive/15",
      glow: "oklch(0.65 0.21 22 / 0.35)",
    },
    info: {
      ring: "ring-info/30",
      text: "text-info",
      bg: "bg-info/15",
      glow: "oklch(0.72 0.13 235 / 0.35)",
    },
  };

  const t = tones[tone] ?? tones["primary"]!;

  return (
    <div
      className="aurora-border glass glass-hover animate-rise group relative overflow-hidden rounded-2xl p-5 hover:glass-hover-on"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="aurora-border-ring" />
      {/* glow blob top-right */}
      <div
        className="absolute -right-12 -top-12 size-32 rounded-full opacity-50 blur-2xl transition-opacity duration-500 group-hover:opacity-90"
        style={{ background: `radial-gradient(circle, ${t.glow}, transparent 70%)` }}
      />
      {/* mini bar chart decorative pattern bottom-left */}
      <div className="absolute bottom-3 left-4 flex h-6 items-end gap-0.5 opacity-30 transition-opacity duration-500 group-hover:opacity-60">
        {[40, 65, 35, 80, 55, 90, 70].map((h, i) => (
          <span
            key={i}
            className={cn("w-1 rounded-full", t.bg, t.text)}
            style={{
              height: `${h}%`,
              backgroundColor: "currentColor",
              opacity: 0.4 + (i / 10),
            }}
          />
        ))}
      </div>

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
            {label}
          </p>
          <p className="font-display mt-2 text-[2rem] font-bold leading-none tabular-nums tracking-tight">
            {value}
          </p>
          {hint ? (
            <p className="mt-2 text-xs font-medium text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-105",
            t.bg,
            t.text,
            t.ring,
          )}
        >
          <Icon className="size-5" strokeWidth={2.2} />
        </span>
      </div>
    </div>
  );
}
