import { useEffect, useState } from "react";
import { Loader2, Send, X, Eye, Pencil, Ban } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequestStatusBadge } from "@/components/billzo/RequestStatusBadge";
import {
  ATTENDANCE_REQUEST_TYPES,
  ATTENDANCE_STATUSES,
  ADJUSTMENT_REQUEST_TYPES,
  LEAVE_REQUEST_TYPES,
  requestTypeLabel,
  formatDate,
  formatTime,
  labelize,
} from "@/lib/billzo";
import {
  useCreateAttendanceRequest,
  useUpdateAttendanceRequest,
  useAgentAttendanceRequests,
  type AttendanceRequest,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

const NONE = "__none__";

/**
 * AgentAttendanceRequests — full agent-facing UI:
 *   - "Submit Request" button
 *   - Create/Edit dialog with dynamic fields based on request type
 *   - "My Requests" table with cancel/edit (pending only)
 *
 * Used by the agent attendance page.
 */
export function AgentAttendanceRequests({ agentId, createdBy }: { agentId: string; createdBy?: string | null }) {
  const { data: requests = [], isLoading } = useAgentAttendanceRequests(agentId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AttendanceRequest | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(r: AttendanceRequest) {
    setEditing(r);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* Header + Submit button */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-foreground/80">
            My Attendance Requests
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            Submit leave, missing check-in, or adjustment requests for admin approval.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="shrink-0">
          <Send className="size-3.5" /> Submit Request
        </Button>
      </div>

      {/* Requests table */}
      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading requests…</p>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 bg-secondary/15 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No requests submitted yet.</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Click "Submit Request" to create one.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/30">
                  {["Type", "Date", "Reason", "Submitted", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {requests.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-secondary/20">
                    <td className="px-3 py-2.5 text-xs font-medium">{requestTypeLabel(r.request_type)}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.from_date && r.to_date
                        ? `${formatDate(r.from_date)} → ${formatDate(r.to_date)}`
                        : r.attendance_date
                          ? formatDate(r.attendance_date)
                          : "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2.5 text-xs text-muted-foreground">
                      {r.reason}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <RequestStatusBadge value={r.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      {r.status === "pending" ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(r)}
                            className="grid size-7 place-items-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-primary/15 hover:text-primary"
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <CancelRequestButton requestId={r.id} />
                        </div>
                      ) : (
                        <ViewRequestButton request={r} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <RequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        agentId={agentId}
        createdBy={createdBy}
      />
    </div>
  );
}

// ── Cancel button ──────────────────────────────────────────────────────────────
function CancelRequestButton({ requestId }: { requestId: string }) {
  const update = useUpdateAttendanceRequest();
  return (
    <button
      onClick={async () => {
        if (!confirm("Cancel this request?")) return;
        try {
          await update.mutateAsync({ id: requestId, status: "cancelled" });
          toast.success("Request cancelled");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not cancel");
        }
      }}
      className="grid size-7 place-items-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-destructive/15 hover:text-destructive"
      title="Cancel"
    >
      <Ban className="size-3.5" />
    </button>
  );
}

// ── View (read-only) button ────────────────────────────────────────────────────
function ViewRequestButton({ request }: { request: AttendanceRequest }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="grid size-7 place-items-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-primary/15 hover:text-primary"
        title="View"
      >
        <Eye className="size-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader className="border-b border-border/40 p-5">
            <DialogTitle className="flex items-center gap-2">
              {requestTypeLabel(request.request_type)}
            </DialogTitle>
            <DialogDescription>
              Submitted {formatDate(request.created_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-5 text-sm">
            <Row label="Status"><RequestStatusBadge value={request.status} /></Row>
            <Row label="Date">
              {request.from_date && request.to_date
                ? `${formatDate(request.from_date)} → ${formatDate(request.to_date)}`
                : request.attendance_date ? formatDate(request.attendance_date) : "—"}
            </Row>
            <Row label="Reason">{request.reason}</Row>
            {request.details && <Row label="Details">{request.details}</Row>}
            {request.requested_clock_in && <Row label="Requested Check-In">{formatTime(request.requested_clock_in)}</Row>}
            {request.requested_clock_out && <Row label="Requested Check-Out">{formatTime(request.requested_clock_out)}</Row>}
            {request.requested_status && <Row label="Requested Status">{labelize(request.requested_status)}</Row>}
            {request.admin_note && <Row label="Admin Note">{request.admin_note}</Row>}
            {request.rejection_reason && <Row label="Rejection Reason"><span className="text-destructive">{request.rejection_reason}</span></Row>}
            {request.reviewed_at && <Row label="Reviewed At">{formatDate(request.reviewed_at)}</Row>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">{label}</span>
      <span className="flex-1 text-sm">{children}</span>
    </div>
  );
}

// ── Create/Edit Dialog ──────────────────────────────────────────────────────────
function RequestDialog({
  open,
  onOpenChange,
  editing,
  agentId,
  createdBy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: AttendanceRequest | null;
  agentId: string;
  createdBy?: string | null;
}) {
  const create = useCreateAttendanceRequest();
  const update = useUpdateAttendanceRequest();
  const saving = create.isPending || update.isPending;

  const [requestType, setRequestType] = useState("leave");
  const [attendanceDate, setAttendanceDate] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [requestedClockIn, setRequestedClockIn] = useState("");
  const [requestedClockOut, setRequestedClockOut] = useState("");
  const [requestedStatus, setRequestedStatus] = useState(NONE);

  useEffect(() => {
    if (open) {
      setRequestType(editing?.request_type ?? "leave");
      setAttendanceDate(editing?.attendance_date ?? "");
      setFromDate(editing?.from_date ?? "");
      setToDate(editing?.to_date ?? "");
      setReason(editing?.reason ?? "");
      setDetails(editing?.details ?? "");
      setRequestedClockIn(editing?.requested_clock_in ? editing.requested_clock_in.slice(0, 16) : "");
      setRequestedClockOut(editing?.requested_clock_out ? editing.requested_clock_out.slice(0, 16) : "");
      setRequestedStatus(editing?.requested_status ?? NONE);
    }
  }, [open, editing]);

  const isLeave = LEAVE_REQUEST_TYPES.has(requestType);
  const isAdjustment = ADJUSTMENT_REQUEST_TYPES.has(requestType);
  const isMultiDay = isLeave; // leave types use from_date/to_date

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    if (isMultiDay) {
      if (!fromDate || !toDate) {
        toast.error("From Date and To Date are required for leave");
        return;
      }
    } else {
      if (!attendanceDate) {
        toast.error("Attendance Date is required");
        return;
      }
    }

    try {
      const payload = {
        agent_id: agentId,
        request_type: requestType,
        attendance_date: isMultiDay ? null : attendanceDate || null,
        from_date: isMultiDay ? fromDate || null : null,
        to_date: isMultiDay ? toDate || null : null,
        reason: reason.trim(),
        details: details.trim() || null,
        requested_clock_in: isAdjustment && requestedClockIn ? new Date(requestedClockIn).toISOString() : null,
        requested_clock_out: isAdjustment && requestedClockOut ? new Date(requestedClockOut).toISOString() : null,
        requested_status: isAdjustment && requestedStatus !== NONE ? requestedStatus : null,
        created_by: createdBy ?? null,
      };

      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
        toast.success("Request updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Request submitted");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save request");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto p-0">
        <DialogHeader className="border-b border-border/40 p-5">
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-4 text-primary" />
            {editing ? "Edit Request" : "Submit Attendance Request"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update your pending request. Once approved/rejected, it can't be edited."
              : "Fill in the details below. Your admin will review and respond."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 p-5">
          {/* Request Type */}
          <div className="space-y-2">
            <Label>Request Type *</Label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ATTENDANCE_REQUEST_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          {isMultiDay ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>From Date *</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>To Date *</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Attendance Date *</Label>
              <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} required />
            </div>
          )}

          {/* Adjustment fields */}
          {isAdjustment && (
            <div className="space-y-3 rounded-lg border border-info/20 bg-info/5 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-info/80">
                Requested Adjustment
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Requested Check-In</Label>
                  <Input type="datetime-local" value={requestedClockIn} onChange={(e) => setRequestedClockIn(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Requested Check-Out</Label>
                  <Input type="datetime-local" value={requestedClockOut} onChange={(e) => setRequestedClockOut(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Requested Status</Label>
                <Select value={requestedStatus} onValueChange={setRequestedStatus}>
                  <SelectTrigger><SelectValue placeholder="Keep current status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Keep current —</SelectItem>
                    {ATTENDANCE_STATUSES.filter((s) => s !== "weekly_off").map((s) => (
                      <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Reason (required) */}
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you're submitting this request..."
              rows={2}
              required
            />
          </div>

          {/* Additional details */}
          <div className="space-y-2">
            <Label>Additional Details (optional)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Any extra context..."
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2 border-t border-border/40 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {editing ? "Update Request" : "Submit Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
