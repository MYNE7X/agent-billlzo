import { useState, useRef, useEffect } from "react";
import { Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * FounderBubble — a small avatar trigger that opens a stylish popup card
 * with the founder's bio.
 *
 * - Desktop: hover to open, mouse-leave to close
 * - Mobile: tap to toggle (also closes on outside tap)
 *
 * Shows the founder's photo, name, title, and bio.
 */
export function FounderBubble() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect touch device for interaction mode
  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia("(hover: none)").matches || window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close on outside click (mobile mode)
  useEffect(() => {
    if (!open || !isMobile) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open, isMobile]);

  const handleTrigger = () => {
    if (isMobile) {
      setOpen((prev) => !prev);
    }
    // Desktop opens on hover via onMouseEnter
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => !isMobile && setOpen(true)}
      onMouseLeave={() => !isMobile && setOpen(false)}
    >
      {/* ── Trigger: small avatar + "Crafted by Aziz" text ────────────────── */}
      <button
        onClick={handleTrigger}
        className="group flex items-center gap-2 rounded-full border border-border/40 bg-secondary/30 py-1 pl-1 pr-3 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-secondary/50"
        aria-label="View founder details"
        aria-expanded={open}
      >
        <span className="relative size-7 shrink-0 overflow-hidden rounded-full ring-1 ring-primary/20">
          <img
            src="/aziz-avatar.png"
            alt="Aziz Ullah"
            className="size-full object-cover"
            draggable={false}
          />
        </span>
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70 transition-colors group-hover:text-foreground">
          <Zap className="size-2.5 fill-primary text-primary" />
          Crafted by Aziz
        </span>
      </button>

      {/* ── Popup card ─────────────────────────────────────────────────────── */}
      {open && (
        <div
          className={cn(
            "aurora-border glass animate-rise absolute bottom-full right-0 z-50 mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl p-5",
            "lg:w-96",
          )}
          role="dialog"
          aria-label="Founder details"
        >
          <span className="aurora-border-ring" />

          {/* Close button (mobile only) */}
          {isMobile && (
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 grid size-6 place-items-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-secondary/60 hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-3.5" />
            </button>
          )}

          <div className="relative flex items-start gap-4">
            {/* Avatar (larger in popup) */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 animate-glow rounded-full opacity-60 blur-md"
                style={{ background: "linear-gradient(135deg, oklch(0.78 0.16 184), oklch(0.7 0.22 350))" }}
              />
              <div className="relative size-16 overflow-hidden rounded-full ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
                <img
                  src="/aziz-portrait.png"
                  alt="Aziz Ullah"
                  className="size-full object-cover"
                  draggable={false}
                />
              </div>
            </div>

            {/* Name + title */}
            <div className="min-w-0 flex-1 pt-1">
              <h3 className="font-display text-lg font-bold leading-tight">
                <span
                  style={{
                    background: "linear-gradient(90deg, oklch(0.82 0.16 184) 0%, oklch(0.7 0.22 350) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Aziz Ullah
                </span>
              </h3>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                Developer & Founder
              </p>
              <p className="mt-1.5 text-[11px] font-medium text-primary/80">
                Founder & CEO — Myne7x
              </p>
              <p className="text-[11px] font-medium text-muted-foreground/60">
                Creator — BILLZO
              </p>
            </div>
          </div>

          {/* Bio */}
          <p className="relative mt-4 text-xs leading-relaxed text-muted-foreground">
            Aziz Ullah, also known as{" "}
            <span className="font-semibold text-foreground/90">Myne Winner</span>, is the
            Founder, CEO, and lead developer behind{" "}
            <span className="font-semibold text-foreground/90">Myne7x</span>. He focuses on
            building modern business platforms, automation systems, SaaS applications, and
            secure digital solutions with a strong emphasis on performance, clean UI, and
            scalable technology.
          </p>

          {/* Bottom accent line */}
          <div className="relative mt-4 flex items-center gap-2 border-t border-border/30 pt-3">
            <Zap className="size-3 fill-primary text-primary" />
            <span className="font-mono text-[10px] font-semibold text-muted-foreground/50">
              · Myne7x
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
