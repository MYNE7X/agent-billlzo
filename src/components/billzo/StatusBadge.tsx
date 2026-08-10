import { cn } from "@/lib/utils";
import { labelize } from "@/lib/billzo";

const TONES: Record<string, { wrapper: string; dot: string; ping?: boolean }> = {
  active:      { wrapper: "bg-success/15 text-success border-success/30",            dot: "bg-success",     ping: true },
  present:     { wrapper: "bg-success/15 text-success border-success/30",            dot: "bg-success",     ping: true },
  inactive:    { wrapper: "bg-muted text-muted-foreground border-border",            dot: "bg-muted-foreground" },
  holiday:     { wrapper: "bg-info/15 text-info border-info/30",                     dot: "bg-info" },
  leave:       { wrapper: "bg-info/15 text-info border-info/30",                     dot: "bg-info" },
  late:        { wrapper: "bg-warning/15 text-warning border-warning/30",            dot: "bg-warning",     ping: true },
  half_day:    { wrapper: "bg-warning/15 text-warning border-warning/30",            dot: "bg-warning" },
  suspended:   { wrapper: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive", ping: true },
  absent:      { wrapper: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
  resigned:    { wrapper: "bg-destructive/10 text-destructive border-destructive/25", dot: "bg-destructive/60" },
};

export function StatusBadge({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const tone = TONES[value] ?? { wrapper: "bg-secondary text-secondary-foreground border-border", dot: "bg-secondary-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        tone.wrapper,
        className,
      )}
    >
      <span className="relative flex size-1.5">
        {tone.ping ? (
          <span className="absolute inline-flex h-full w-full animate-status-ping rounded-full bg-current opacity-75" />
        ) : null}
        <span className={cn("relative inline-flex size-1.5 rounded-full", tone.dot)} />
      </span>
      {labelize(value)}
    </span>
  );
}
