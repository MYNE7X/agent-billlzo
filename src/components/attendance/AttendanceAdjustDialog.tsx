import { useEffect, useState } from "react";
import { CalendarClock, Check, Loader2, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";
import { useAgents, useInsertAttendance, useUpdateAttendance, type AttendanceRow } from "@/lib/queries";
import { ATTENDANCE_STATUSES, labelize, todayISO } from "@/lib/billzo";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Convert an ISO datetime string → "HH:MM" for <input type="time"> */
function isoToTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Combine a date string "YYYY-MM-DD" + time "HH:MM" → ISO string in local tz.
 *  If `forClockOut` is true and `time` is earlier than `clockInTime`, the
 *  resulting date is rolled to the NEXT day — this correctly handles night
 *  shifts that cross midnight (e.g. clock-in 21:00 → clock-out 06:00 next day).
 */
function toISO(date: string, time: string, opts?: { forClockOut?: boolean; clockInTime?: string }): string | null {
  if (!date || !time) return null;
  let dateStr = date;
  if (opts?.forClockOut && opts.clockInTime) {
    // Compare HH:MM strings lexicographically — works because they're zero-padded.
    if (time < opts.clockInTime) {
      // clock-out is earlier in the day than clock-in → must be next day
      const d = new Date(`${date}T00:00:00`);
      d.setDate(d.getDate() + 1);
      dateStr = d.toISOString().slice(0, 10);
    }
  }
  return new Date(`${dateStr}T${time}:00`).toISOString();
}

/* ------------------------------------------------------------------ */
/*  Edit existing record                                                */
/* ------------------------------------------------------------------ */

type EditProps = {
  row: AttendanceRow;
  trigger?: React.ReactNode;
};

export function AttendanceEditDialog({ row, trigger }: EditProps) {
  const [open, setOpen] = useState(false);
  const [clockIn, setClockIn] = useState(isoToTime(row.clock_in));
  const [clockOut, setClockOut] = useState(isoToTime(row.clock_out));
  const [status, setStatus] = useState<AttendanceStatus>(row.status ?? "present");
  const [notes, setNotes] = useState<string>(row.notes ?? "");
  const update = useUpdateAttendance();

  // reset whenever row changes / dialog reopens
  useEffect(() => {
    if (open) {
      setClockIn(isoToTime(row.clock_in));
      setClockOut(isoToTime(row.clock_out));
      setStatus(row.status ?? "present");
      setNotes(row.notes ?? "");
    }
  }, [open, row]);

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        id: row.id,
        values: {
          clock_in: clockIn ? toISO(row.date, clockIn) : null,
          clock_out: clockOut ? toISO(row.date, clockOut, { forClockOut: true, clockInTime: clockIn }) : null,
          status: (status || null) as AttendanceStatus | null,
          notes: notes || null,
        },
      });
      toast.success(`Attendance adjusted for ${row.agents?.full_name ?? "agent"}.`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-primary">
            <Pencil className="size-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-primary" />
            Adjust Attendance
          </DialogTitle>
          <DialogDescription>
            Editing record for <strong>{row.agents?.full_name ?? "—"}</strong> on{" "}
            <strong>{row.date}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="adj-in">Clock In</Label>
              <Input
                id="adj-in"
                type="time"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-out">Clock Out</Label>
              <Input
                id="adj-out"
                type="time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AttendanceStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {ATTENDANCE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adj-note">Admin Note (optional)</Label>
            <Textarea
              id="adj-note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for adjustment…"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Add new manual record                                               */
/* ------------------------------------------------------------------ */

type AddProps = {
  defaultDate?: string;
  createdBy?: string | null | undefined;
  trigger?: React.ReactNode;
};

export function AttendanceAddDialog({ defaultDate, createdBy, trigger }: AddProps) {
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayISO());
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [notes, setNotes] = useState("");
  const insert = useInsertAttendance();
  const { data: agents = [] } = useAgents();

  useEffect(() => {
    if (open) {
      setDate(defaultDate ?? todayISO());
      setAgentId("");
      setClockIn("");
      setClockOut("");
      setStatus("present");
      setNotes("");
    }
  }, [open, defaultDate]);

  const handleAdd = async () => {
    if (!agentId) { toast.error("Please select an agent."); return; }
    try {
      await insert.mutateAsync({
        agent_id: agentId,
        date,
        clock_in: clockIn ? toISO(date, clockIn) : null,
        clock_out: clockOut ? toISO(date, clockOut, { forClockOut: true, clockInTime: clockIn }) : null,
        status: (status || null) as AttendanceStatus | null,
        notes: notes || null,
        created_by: createdBy ?? null,
      });
      const name = agents.find((a) => a.id === agentId)?.full_name ?? "Agent";
      toast.success(`Attendance record added for ${name}.`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add record.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus className="size-4" /> Add Record
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-5 text-primary" />
            Add Attendance Record
          </DialogTitle>
          <DialogDescription>
            Manually create an attendance entry for any agent on any date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select agent…" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.full_name} <span className="text-muted-foreground">· {a.employee_id}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-date">Date</Label>
            <Input
              id="add-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-in">Clock In</Label>
              <Input
                id="add-in"
                type="time"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-out">Clock Out</Label>
              <Input
                id="add-out"
                type="time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AttendanceStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {ATTENDANCE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-note">Note (optional)</Label>
            <Textarea
              id="add-note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for manual entry…"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={insert.isPending}>
            {insert.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
