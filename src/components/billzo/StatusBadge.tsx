import { cn } from "@/lib/utils";
import { labelize } from "@/lib/billzo";

const TONES: Record<string, string> = {
  active: "bg-success/15 text-success border-success/30",
  present: "bg-success/15 text-success border-success/30",
  inactive: "bg-muted text-muted-foreground border-border",
  holiday: "bg-info/15 text-info border-info/30",
  leave: "bg-info/15 text-info border-info/30",
  late: "bg-warning/15 text-warning border-warning/30",
  half_day: "bg-warning/15 text-warning border-warning/30",
  suspended: "bg-destructive/15 text-destructive border-destructive/30",
  absent: "bg-destructive/15 text-destructive border-destructive/30",
  resigned: "bg-destructive/10 text-destructive border-destructive/25",
};

export function StatusBadge({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        TONES[value] ?? "bg-secondary text-secondary-foreground border-border",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {labelize(value)}
    </span>
  );
}