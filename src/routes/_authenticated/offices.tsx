import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Search,
  MapPin,
  Users,
  Power,
  Loader2,
  X,
  Hash,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import {
  useOfficesWithCounts,
  useUpsertOffice,
  useDeleteOffice,
  useToggleOfficeStatus,
} from "@/lib/queries";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/offices")({
  component: OfficesPage,
});

type OfficeWithCount = {
  id: string;
  office_name: string;
  office_code: string;
  location: string | null;
  description: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  agent_count: number;
};

function OfficesPage() {
  const { user, isStaff, isSuperAdmin } = useAuth();
  const { data: offices = [], isLoading } = useOfficesWithCounts();
  const upsert = useUpsertOffice();
  const del = useDeleteOffice();
  const toggle = useToggleOfficeStatus();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OfficeWithCount | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OfficeWithCount | null>(null);

  // ── Guard: only staff can access ───────────────────────────────────────────
  // (RLS enforces this server-side too; this is just a UX guard)
  if (!isStaff) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <div className="grid size-16 place-items-center rounded-2xl bg-secondary/40 ring-1 ring-border">
          <Building2 className="size-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Admins only</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Office management is restricted to Admins and Super Admins.
        </p>
      </div>
    );
  }

  const filtered = useMemo(() => {
    let r = offices as OfficeWithCount[];
    if (statusFilter !== "all") r = r.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (o) =>
          o.office_name.toLowerCase().includes(q) ||
          o.office_code.toLowerCase().includes(q) ||
          (o.location ?? "").toLowerCase().includes(q),
      );
    }
    return r;
  }, [offices, search, statusFilter]);

  const stats = useMemo(() => {
    const all = offices as OfficeWithCount[];
    return {
      total: all.length,
      active: all.filter((o) => o.status === "active").length,
      inactive: all.filter((o) => o.status === "inactive").length,
      agentsAssigned: all.reduce((s, o) => s + o.agent_count, 0),
    };
  }, [offices]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(o: OfficeWithCount) {
    setEditing(o);
    setDialogOpen(true);
  }

  async function handleSubmit(values: {
    office_name: string;
    office_code: string;
    location: string;
    description: string;
    status: string;
  }) {
    try {
      await upsert.mutateAsync({
        id: editing?.id,
        office_name: values.office_name,
        office_code: values.office_code.toUpperCase(),
        location: values.location || null,
        description: values.description || null,
        status: values.status,
        created_by: editing?.created_by ?? user?.id ?? null,
      });
      toast.success(editing ? "Office updated" : "Office created");
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save office");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await del.mutateAsync(pendingDelete.id);
      toast.success("Office deleted");
      setPendingDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  async function handleToggle(o: OfficeWithCount) {
    const next = o.status === "active" ? "inactive" : "active";
    try {
      await toggle.mutateAsync({ id: o.id, status: next });
      toast.success(`Office ${next === "active" ? "activated" : "deactivated"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not toggle status");
    }
  }

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
          <div
            className="absolute -bottom-16 left-1/4 size-64 animate-aurora rounded-full opacity-35 blur-[100px]"
            style={{
              background: "radial-gradient(circle, oklch(0.7 0.22 350 / 0.4), transparent 70%)",
              animationDelay: "-7s",
            }}
          />
        </div>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="absolute inset-x-0 top-1 h-[1px] bg-gradient-to-r from-transparent via-fuchsia-500/30 to-transparent" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="aurora-border relative grid size-12 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
              <span className="aurora-border-ring" />
              <Building2 className="relative size-6 text-primary" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                <span className="text-gradient-aurora">Office Management</span>
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground/70">
                Create and manage Billzo office locations. Assign agents to offices and filter data by office.
              </p>
            </div>
          </div>
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="size-4" /> New Office
          </Button>
        </div>
      </div>

      {/* ── SUMMARY STRIP ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Offices", value: String(stats.total), icon: Building2, color: "text-primary", bg: "bg-primary/10", ring: "ring-primary/20" },
          { label: "Active", value: String(stats.active), icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20" },
          { label: "Inactive", value: String(stats.inactive), icon: Power, color: "text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/20" },
          { label: "Agents Assigned", value: String(stats.agentsAssigned), icon: Users, color: "text-info", bg: "bg-info/10", ring: "ring-info/20" },
        ].map((s) => (
          <div key={s.label} className={cn("glass flex items-center gap-3 rounded-2xl p-4 ring-1", s.bg, s.ring)}>
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", s.bg, s.color)}>
              <s.icon className="size-4.5" strokeWidth={2.2} />
            </span>
            <div>
              <p className={cn("font-mono text-xl font-bold tabular-nums", s.color)}>{s.value}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── FILTERS ───────────────────────────────────────────────────────────── */}
      <div className="glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Search office name, code, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── OFFICE LIST ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !filtered.length ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-secondary/40 ring-1 ring-border">
            <Building2 className="size-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No offices found</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {offices.length === 0
              ? "Create your first office to get started."
              : "Try adjusting your search or filter."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((o) => (
            <OfficeCard
              key={o.id}
              office={o}
              onEdit={() => openEdit(o)}
              onDelete={() => setPendingDelete(o)}
              onToggle={() => handleToggle(o)}
            />
          ))}
        </div>
      )}

      {/* ── CREATE / EDIT DIALOG ──────────────────────────────────────────────── */}
      <OfficeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        saving={upsert.isPending}
        onSubmit={handleSubmit}
      />

      {/* ── DELETE CONFIRMATION ───────────────────────────────────────────────── */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Delete office?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{pendingDelete?.office_name}</strong> ({pendingDelete?.office_code}).
              {pendingDelete && pendingDelete.agent_count > 0 && (
                <>
                  {" "}
                  This office has <strong>{pendingDelete.agent_count} agent{pendingDelete.agent_count === 1 ? "" : "s"}</strong> assigned —
                  they will be set to <strong>"Office Not Assigned"</strong> (their data is preserved).
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Office Card ────────────────────────────────────────────────────────────────

function OfficeCard({
  office,
  onEdit,
  onDelete,
  onToggle,
}: {
  office: OfficeWithCount;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const isActive = office.status === "active";
  return (
    <div className={cn(
      "aurora-border glass glass-hover group relative overflow-hidden rounded-2xl p-5 hover:glass-hover-on",
      !isActive && "opacity-60",
    )}>
      <span className="aurora-border-ring" />
      {/* status dot */}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl ring-1",
            isActive ? "bg-primary/15 text-primary ring-primary/20" : "bg-secondary/40 text-muted-foreground ring-border",
          )}>
            <Building2 className="size-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-bold">{office.office_name}</h3>
            <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-muted-foreground/70">
              <Hash className="size-3" />{office.office_code}
            </p>
          </div>
        </div>
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
          isActive ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground",
        )}>
          <span className={cn("size-1.5 rounded-full", isActive ? "bg-success" : "bg-muted-foreground/50")} />
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {office.location && (
        <p className="relative mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0 text-primary/60" />
          <span className="truncate">{office.location}</span>
        </p>
      )}

      {office.description && (
        <p className="relative mt-2 line-clamp-2 text-xs text-muted-foreground/70">{office.description}</p>
      )}

      {/* agent count */}
      <div className="relative mt-4 flex items-center justify-between">
        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold",
          office.agent_count > 0 ? "bg-info/10 text-info" : "bg-secondary/40 text-muted-foreground",
        )}>
          <Users className="size-3.5" />
          {office.agent_count} agent{office.agent_count === 1 ? "" : "s"}
        </span>
      </div>

      {/* actions */}
      <div className="relative mt-4 flex items-center gap-2 border-t border-border/40 pt-3">
        <Button size="sm" variant="ghost" className="flex-1" onClick={onEdit}>
          <Pencil className="size-3.5" /> Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={cn(isActive ? "text-amber-400 hover:bg-amber-500/10" : "text-emerald-400 hover:bg-emerald-500/10")}
          onClick={onToggle}
        >
          <Power className="size-3.5" />
          <span className="hidden sm:inline">{isActive ? "Deactivate" : "Activate"}</span>
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Create / Edit Dialog ──────────────────────────────────────────────────────

function OfficeDialog({
  open,
  onOpenChange,
  editing,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: OfficeWithCount | null;
  saving: boolean;
  onSubmit: (v: { office_name: string; office_code: string; location: string; description: string; status: string }) => void;
}) {
  const [officeName, setOfficeName] = useState("");
  const [officeCode, setOfficeCode] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");

  useEffect(() => {
    if (open) {
      setOfficeName(editing?.office_name ?? "");
      setOfficeCode(editing?.office_code ?? "");
      setLocation(editing?.location ?? "");
      setDescription(editing?.description ?? "");
      setStatus(editing?.status ?? "active");
    }
  }, [open, editing]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!officeName.trim()) {
      toast.error("Office name is required");
      return;
    }
    if (!officeCode.trim()) {
      toast.error("Office code is required");
      return;
    }
    onSubmit({
      office_name: officeName.trim(),
      office_code: officeCode.trim(),
      location: location.trim(),
      description: description.trim(),
      status,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="border-b border-border/40 p-5">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            {editing ? "Edit Office" : "Create Office"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the office details below."
              : "Add a new Billzo office location. Agents can be assigned to this office afterwards."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="office_name">Office Name *</Label>
              <Input
                id="office_name"
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                placeholder="e.g. BILLZO Lahore"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="office_code">Office Code *</Label>
              <Input
                id="office_code"
                value={officeCode}
                onChange={(e) => setOfficeCode(e.target.value.toUpperCase())}
                placeholder="e.g. LHR"
                required
                className="font-mono uppercase"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Model Town, Lahore, Punjab"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this office..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex items-center gap-2">
              {(["active", "inactive"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-sm font-semibold capitalize transition-colors",
                    status === s
                      ? s === "active"
                        ? "bg-success/15 text-success ring-1 ring-success/30"
                        : "bg-secondary text-muted-foreground ring-1 ring-border"
                      : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-border/40 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {editing ? "Save Changes" : "Create Office"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
