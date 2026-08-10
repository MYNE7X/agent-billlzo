import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Inbox,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  Filter,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import {
  useAttendanceRequests,
  useReviewAttendanceRequest,
  useOfficesMap,
  type AttendanceRequestWithAgent,
} from "@/lib/queries";
import {
  ATTENDANCE_REQUEST_TYPES,
  ATTENDANCE_REQUEST_STATUSES,
  requestTypeLabel,
  formatDate,
  formatTime,
  labelize,
} from "@/lib/billzo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RequestStatusBadge } from "@/components/billzo/RequestStatusBadge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance-requests")({
  component: AttendanceRequestsPage,
});

function AttendanceRequestsPage() {
  const { user, isStaff } = useAuth();
  const { data: requests = [], isLoading } = useAttendanceRequests();
  const officesMap = useOfficesMap();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [officeFilter, setOfficeFilter] = useState("all");
  const [reviewing, setReviewing] = useState<AttendanceRequestWithAgent | null>(null);

  if (!isStaff) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <div className="grid size-16 place-items-center rounded-2xl bg-secondary/40 ring-1 ring-border">
          <Inbox className="size-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Admins only</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Attendance request management is restricted to Admins and Super Admins.
        </p>
      </div>
    );
  }

  const filtered = useMemo(() => {
    let r = requests;
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (typeFilter !== "all") r = r.filter((x) => x.request_type === typeFilter);
    if (officeFilter !== "all") r = r.filter((x) => x.agents?.office_id === officeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (x) =>
          x.agents?.full_name?.toLowerCase().includes(q) ||
          x.agents?.employee_id?.toLowerCase().includes(q) ||
          x.reason?.toLowerCase().includes(q),
      );
    }
    return r;
  }, [requests, search, statusFilter, typeFilter, officeFilter]);

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  }), [requests]);

  // Collect unique office IDs from agents for the filter
  const officeOptions = useMemo(() => {
    const ids = new Set<string>();
    requests.forEach((r) => {
      if (r.agents?.office_id) ids.add(r.agents.office_id);
    });
    return Array.from(ids).map((id) => ({ id, name: officesMap.get(id)?.office_name ?? "Unknown" }));
  }, [requests, officesMap]);

  return (
    <div className="space-y-6">
      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <div className="aurora-border glass-strong animate-rise relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <span className="aurora-border-ring" />
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -right-20 -top-24 size-80 animate-aurora rounded-full opacity-50 blur-[100px]"
            style={{ background: "radial-gradient(circle, oklch(0.78 0.16 184 / 0.45), transparent 70%)" }}
          />
        </div>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="aurora-border relative grid size-12 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
              <span className="aurora-border-ring" />
              <Inbox className="relative size-6 text-primary" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                <span className="text-gradient-aurora">Attendance Requests</span>
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground/70">
                Review and approve agent attendance requests.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUMMARY STRIP ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: stats.total, color: "text-primary", bg: "bg-primary/10", ring: "ring-primary/20" },
          { label: "Pending", value: stats.pending, color: "text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/20" },
          { label: "Approved", value: stats.approved, color: "text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20" },
          { label: "Rejected", value: stats.rejected, color: "text-red-400", bg: "bg-red-500/10", ring: "ring-red-500/20" },
        ].map((s) => (
          <div key={s.label} className={cn("glass flex items-center gap-3 rounded-2xl p-4 ring-1", s.bg, s.ring)}>
            <span className={cn("font-mono text-xl font-bold tabular-nums", s.color)}>{s.value}</span>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── FILTERS ───────────────────────────────────────────────────────────── */}
      <div className="glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Search agent, employee ID, or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ATTENDANCE_REQUEST_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="sm:w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ATTENDANCE_REQUEST_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {officeOptions.length > 0 && (
          <Select value={officeFilter} onValueChange={setOfficeFilter}>
            <SelectTrigger className="sm:w-36"><SelectValue placeholder="Office" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All offices</SelectItem>
              {officeOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── LIST ──────────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !filtered.length ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-secondary/40 ring-1 ring-border">
            <Inbox className="size-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No requests found</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {requests.length === 0 ? "No attendance requests have been submitted yet." : "Try adjusting your filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/30">
                  {["Agent", "Type", "Date", "Reason", "Submitted", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filtered.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-secondary/20">
                    <td className="px-4 py-2.5">
                      <div className="text-xs font-semibold">{r.agents?.full_name ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground/70">{r.agents?.employee_id ?? "—"}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{requestTypeLabel(r.request_type)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {r.from_date && r.to_date
                        ? `${formatDate(r.from_date)} → ${formatDate(r.to_date)}`
                        : r.attendance_date ? formatDate(r.attendance_date) : "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-2.5 text-xs text-muted-foreground">{r.reason}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-2.5"><RequestStatusBadge value={r.status} /></td>
                    <td className="px-4 py-2.5">
                      <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setReviewing(r)}>
                        <Eye className="size-3.5" /> Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Review Dialog ─────────────────────────────────────────────────────── */}
      {reviewing && (
        <ReviewDialog
          request={reviewing}
          open={!!reviewing}
          onOpenChange={(o) => !o && setReviewing(null)}
          reviewerId={user?.id ?? ""}
          officeName={reviewing.agents?.office_id ? officesMap.get(reviewing.agents.office_id)?.office_name ?? null : null}
        />
      )}
    </div>
  );
}

// ── Review Dialog (approve/reject) ─────────────────────────────────────────────
function ReviewDialog({
  request,
  open,
  onOpenChange,
  reviewerId,
  officeName,
}: {
  request: AttendanceRequestWithAgent;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reviewerId: string;
  officeName: string | null;
}) {
  const review = useReviewAttendanceRequest();
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  async function handleSubmit() {
    if (!decision) {
      toast.error("Choose Approve or Reject");
      return;
    }
    if (decision === "rejected" && !rejectionReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    try {
      await review.mutateAsync({
        request,
        decision,
        admin_note: adminNote.trim() || undefined,
        rejection_reason: decision === "rejected" ? rejectionReason.trim() : undefined,
        reviewer_id: reviewerId,
      });
      toast.success(`Request ${decision}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not review request");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto p-0">
        <DialogHeader className="border-b border-border/40 p-5">
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="size-5 text-primary" />
            Review Request
          </DialogTitle>
          <DialogDescription>
            {request.agents?.full_name} · {request.agents?.employee_id}
            {officeName ? ` · ${officeName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 p-5 text-sm">
          {/* Request details */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" value={requestTypeLabel(request.request_type)} />
            <Field label="Status" value={<RequestStatusBadge value={request.status} />} />
            <Field label="Date" value={
              request.from_date && request.to_date
                ? `${formatDate(request.from_date)} → ${formatDate(request.to_date)}`
                : request.attendance_date ? formatDate(request.attendance_date) : "—"
            } />
            <Field label="Submitted" value={formatDate(request.created_at)} />
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Reason</p>
            <p className="mt-1 rounded-lg bg-secondary/30 px-3 py-2 text-sm">{request.reason}</p>
          </div>

          {request.details && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Details</p>
              <p className="mt-1 rounded-lg bg-secondary/30 px-3 py-2 text-sm">{request.details}</p>
            </div>
          )}

          {request.requested_clock_in && (
            <Field label="Requested Check-In" value={formatTime(request.requested_clock_in)} />
          )}
          {request.requested_clock_out && (
            <Field label="Requested Check-Out" value={formatTime(request.requested_clock_out)} />
          )}
          {request.requested_status && (
            <Field label="Requested Status" value={labelize(request.requested_status)} />
          )}

          {/* Review fields (only for pending) */}
          {request.status === "pending" ? (
            <div className="space-y-4 border-t border-border/40 pt-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Decision *
                </Label>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setDecision("approved")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors",
                      decision === "approved"
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                        : "border-border/50 bg-secondary/30 text-muted-foreground hover:bg-secondary/50",
                    )}
                  >
                    <CheckCircle2 className="size-4" /> Approve
                  </button>
                  <button
                    onClick={() => setDecision("rejected")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors",
                      decision === "rejected"
                        ? "border-red-500/40 bg-red-500/15 text-red-400"
                        : "border-border/50 bg-secondary/30 text-muted-foreground hover:bg-secondary/50",
                    )}
                  >
                    <XCircle className="size-4" /> Reject
                  </button>
                </div>
              </div>

              {decision === "rejected" && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-widest text-red-400/80">
                    Rejection Reason *
                  </Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this request is being rejected..."
                    rows={2}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Admin Note (optional)
                </Label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add a note for the agent..."
                  rows={2}
                />
              </div>
            </div>
          ) : (
            /* Already reviewed — show review info */
            <div className="space-y-2 border-t border-border/40 pt-4">
              {request.admin_note && <Field label="Admin Note" value={request.admin_note} />}
              {request.rejection_reason && (
                <Field label="Rejection Reason" value={<span className="text-destructive">{request.rejection_reason}</span>} />
              )}
              {request.reviewed_at && <Field label="Reviewed At" value={formatDate(request.reviewed_at)} />}
            </div>
          )}
        </div>

        {request.status === "pending" && (
          <DialogFooter className="gap-2 border-t border-border/40 p-5">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={review.isPending || !decision}>
              {review.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {decision === "approved" ? "Approve Request" : decision === "rejected" ? "Reject Request" : "Submit Review"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}
