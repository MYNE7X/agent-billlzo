import { useEffect, useState, useRef, useCallback } from "react";
import { Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchUserInfo, type UserInfo, useEditHistory, type EditHistoryEntry } from "@/lib/queries";
import { formatDate } from "@/lib/billzo";

/**
 * EditorBubble — a small eye icon that opens a popup showing who last edited
 * a section, and optionally the full edit history.
 *
 * - Desktop: hover OR click to open
 * - Mobile: tap to toggle, outside-tap to close
 */
export function EditorBubble({
  editedBy,
  editedAt,
  entityType,
  entityId,
  section,
  label = "Edited by",
}: {
  editedBy?: string | null;
  editedAt?: string | null;
  entityType?: string;
  entityId?: string;
  section?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  const effectiveEditedBy = editedBy ?? "__system__";

  // Detect touch device
  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia("(hover: none)").matches || window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fetch user info when opened
  useEffect(() => {
    if (!open || userInfo) return;
    if (effectiveEditedBy === "__system__") {
      setUserInfo({ full_name: "System", email: "Auto-generated", avatar_url: null });
      return;
    }
    setLoading(true);
    void fetchUserInfo(effectiveEditedBy).then((info) => {
      setUserInfo(info);
      setLoading(false);
    });
  }, [open, effectiveEditedBy, userInfo]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        popupRef.current && !popupRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={() => !isMobile && setOpen(true)}
      onMouseLeave={() => !isMobile && setOpen(false)}
    >
      {/* Trigger — eye icon (click works on ALL devices) */}
      <button
        onClick={handleToggle}
        className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground/40 transition-colors hover:bg-primary/15 hover:text-primary"
        aria-label={`${label} — view details`}
        aria-expanded={open}
      >
        <Eye className="size-3" />
      </button>

      {/* Popup — absolute positioned, high z-index, renders above everything */}
      {open && (
        <div
          ref={popupRef}
          className="aurora-border glass animate-rise absolute right-0 top-full z-[9999] mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-xl p-4 shadow-2xl"
          role="tooltip"
          style={{ position: "absolute" }}
        >
          {/* Close button */}
          <button
            onClick={() => setOpen(false)}
            className="absolute right-2 top-2 grid size-5 place-items-center rounded-md text-muted-foreground/60 transition-colors hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-3" />
          </button>

          {loading ? (
            <div className="flex items-center gap-2 py-2">
              <div className="size-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              <span className="text-xs text-muted-foreground">Loading…</span>
            </div>
          ) : userInfo ? (
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="absolute inset-0 animate-glow rounded-full opacity-50 blur-md"
                  style={{ background: "linear-gradient(135deg, oklch(0.78 0.16 184), oklch(0.7 0.22 350))" }}
                />
                <div className="relative grid size-10 place-items-center overflow-hidden rounded-full ring-1 ring-primary/20">
                  {userInfo.avatar_url ? (
                    <img src={userInfo.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/20 to-fuchsia-500/15">
                      <span className="text-sm font-bold text-primary">
                        {(userInfo.full_name ?? userInfo.email ?? "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Name + email */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{userInfo.full_name ?? "Unknown"}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{userInfo.email}</p>
                {editedAt && (
                  <p className="mt-1 text-[10px] text-muted-foreground/50">
                    {label} · {formatDate(editedAt)}
                  </p>
                )}
                {section && (
                  <p className="mt-0.5 text-[10px] font-medium text-primary/60">Section: {section}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-2 text-center">
              <p className="text-xs text-muted-foreground">User info not available</p>
              {editedAt && (
                <p className="mt-1 text-[10px] text-muted-foreground/50">{formatDate(editedAt)}</p>
              )}
            </div>
          )}

          {/* Edit history (if entityType + entityId provided) */}
          {entityType && entityId && (
            <EditHistoryList entityType={entityType} entityId={entityId} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Edit history list (shown inside the bubble) ────────────────────────────────
function EditHistoryList({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data: history = [] } = useEditHistory(entityType, entityId);

  if (history.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border/30 pt-2">
      <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
        Edit History ({history.length})
      </p>
      <div className="max-h-32 space-y-1 overflow-y-auto">
        {history.slice(0, 8).map((entry: EditHistoryEntry) => (
          <HistoryRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function HistoryRow({ entry }: { entry: EditHistoryEntry }) {
  const [info, setInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    if (!entry.edited_by) return;
    void fetchUserInfo(entry.edited_by).then(setInfo);
  }, [entry.edited_by]);

  return (
    <div className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[10px] transition-colors hover:bg-secondary/40">
      <div className="grid size-5 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary/60">
        {info?.avatar_url ? (
          <img src={info.avatar_url} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-[8px] font-bold text-muted-foreground">
            {(info?.full_name ?? info?.email ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="font-medium text-foreground/80">
          {info?.full_name ?? info?.email?.split("@")[0] ?? "Unknown"}
        </span>
        {entry.section && <span className="text-muted-foreground/50"> · {entry.section}</span>}
      </div>
      <span className="shrink-0 text-muted-foreground/40">{formatDate(entry.edited_at)}</span>
    </div>
  );
}
