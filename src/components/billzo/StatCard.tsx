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
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary/12 ring-primary/25",
    success: "text-success bg-success/12 ring-success/25",
    warning: "text-warning bg-warning/12 ring-warning/25",
    destructive: "text-destructive bg-destructive/12 ring-destructive/25",
    info: "text-info bg-info/12 ring-info/25",
  };

  return (
    <div
      className="glass glass-hover animate-rise group relative overflow-hidden rounded-2xl p-5 hover:glass-hover-on"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute -right-10 -top-12 size-32 rounded-full bg-primary/10 blur-2xl transition-opacity duration-500 group-hover:opacity-80 opacity-40" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="font-display mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl ring-1", tones[tone])}>
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}