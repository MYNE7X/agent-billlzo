import { cn } from "@/lib/utils";
import { labelize } from "@/lib/billzo";

const TONES: Record<string, { wrapper: string; dot: string; ping?: boolean }> = {
  pending:   { wrapper: "bg-amber-500/15 text-amber-400 border-amber-500/30",     dot: "bg-amber-400",  ping: true },
  approved:  { wrapper: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
  rejected:  { wrapper: "bg-red-500/15 text-red-400 border-red-500/30",            dot: "bg-red-400" },
  cancelled: { wrapper: "bg-secondary text-muted-foreground border-border",        dot: "bg-muted-foreground/50" },
};

export function RequestStatusBadge({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const tone = TONES[value] ?? TONES.cancelled!;
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
