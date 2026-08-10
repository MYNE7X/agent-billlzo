import { useState } from "react";
import {
  Wifi, WifiOff, Plus, Trash2, Edit2, Check, X, RefreshCw,
  ShieldAlert, Clock, User, Globe, ToggleLeft, ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useNetworkSettings,
  useSaveNetworkSetting,
  useDeleteNetworkSetting,
  useAttendanceViolations,
  type NetworkSetting,
  type AttendanceViolation,
} from "@/lib/queries";
import { getPublicIP } from "@/lib/network";
import { useAuth } from "@/hooks/useAuth";

// ── Allowed Networks Panel ─────────────────────────────────────────────────────

function NetworkRow({
  net,
  onEdit,
  onDelete,
  onToggle,
}: {
  net: NetworkSetting;
  onEdit: (n: NetworkSetting) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
        net.enabled
          ? "border-emerald-500/25 bg-emerald-500/5"
          : "border-border/30 bg-secondary/20 opacity-60"
      }`}
    >
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
          net.enabled ? "bg-emerald-500/15" : "bg-secondary/40"
        }`}
      >
        {net.enabled ? (
          <Wifi className="size-4 text-emerald-400" />
        ) : (
          <WifiOff className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">{net.name}</p>
        <p className="font-mono text-xs text-muted-foreground">{net.allowed_ip}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          className="size-8 p-0"
          title={net.enabled ? "Disable" : "Enable"}
          onClick={() => onToggle(net.id, !net.enabled)}
        >
          {net.enabled ? (
            <ToggleRight className="size-4 text-emerald-400" />
          ) : (
            <ToggleLeft className="size-4 text-muted-foreground" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="size-8 p-0"
          onClick={() => onEdit(net)}
        >
          <Edit2 className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="size-8 p-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(net.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function NetworkForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: NetworkSetting | null;
  onSave: (name: string, ip: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [ip, setIp] = useState(initial?.allowed_ip ?? "");
  const [detecting, setDetecting] = useState(false);

  async function detectMyIP() {
    setDetecting(true);
    try {
      const myIp = await getPublicIP();
      setIp(myIp);
      toast.success(`Detected: ${myIp}`);
    } catch {
      toast.error("Could not detect public IP");
    } finally {
      setDetecting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimName = name.trim();
    const trimIp = ip.trim();
    if (!trimName || !trimIp) {
      toast.error("Name and IP are required");
      return;
    }
    // Basic IPv4 validation
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(trimIp)) {
      toast.error("Enter a valid IPv4 address (e.g. 203.0.113.42)");
      return;
    }
    onSave(trimName, trimIp);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"
    >
      <p className="text-sm font-semibold text-primary/80">
        {initial ? "Edit Network" : "Add Allowed Network"}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder='Network label (e.g. "HMR 5G")'
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <div className="flex flex-1 gap-2">
          <Input
            placeholder="Public IP (e.g. 203.0.113.42)"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            className="flex-1 font-mono text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            title="Auto-detect my current public IP"
            disabled={detecting}
            onClick={detectMyIP}
          >
            {detecting ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Globe className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="gap-1.5">
          <Check className="size-3.5" /> Save
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} className="gap-1.5">
          <X className="size-3.5" /> Cancel
        </Button>
      </div>
    </form>
  );
}

export function AllowedNetworksPanel() {
  const { user } = useAuth();
  const { data: networks = [], isLoading, refetch } = useNetworkSettings();
  const save = useSaveNetworkSetting();
  const del = useDeleteNetworkSetting();
  const [editing, setEditing] = useState<NetworkSetting | null | "new">(null);

  async function handleSave(name: string, ip: string) {
    try {
      await save.mutateAsync({
        id: editing && editing !== "new" ? editing.id : undefined,
        name,
        allowed_ip: ip,
        enabled: true,
        createdBy: user?.id,
      });
      toast.success(editing === "new" ? "Network added" : "Network updated");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this network? Agents on it will no longer be able to clock in.")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Network removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    try {
      const net = networks.find((n) => n.id === id);
      if (!net) return;
      await save.mutateAsync({ id, name: net.name, allowed_ip: net.allowed_ip, enabled });
      toast.success(enabled ? "Network enabled" : "Network disabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Wifi className="size-5 text-primary" />
            Allowed Networks
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Agents can only clock in when connected to one of these networks.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="size-8 p-0"
            title="Refresh"
            onClick={() => void refetch()}
          >
            <RefreshCw className="size-3.5" />
          </Button>
          {editing === null && (
            <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}>
              <Plus className="size-3.5" /> Add Network
            </Button>
          )}
        </div>
      </div>

      {editing === "new" && (
        <div className="mb-4">
          <NetworkForm onSave={handleSave} onCancel={() => setEditing(null)} />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : networks.length === 0 && editing === null ? (
        <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <WifiOff className="mx-auto mb-2 size-8 text-amber-400/60" />
          <p className="font-medium text-amber-300/80">No networks configured</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Until at least one enabled network is added, agents can clock in from anywhere.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {networks.map((net) =>
            editing && editing !== "new" && editing.id === net.id ? (
              <NetworkForm
                key={net.id}
                initial={net}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <NetworkRow
                key={net.id}
                net={net}
                onEdit={setEditing}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Violations Log Panel ───────────────────────────────────────────────────────

function formatDT(iso: string) {
  return new Date(iso).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ViolationRow({ v }: { v: AttendanceViolation }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground/60 shrink-0">
        <Clock className="size-3.5" />
        <span className="font-mono text-xs">{formatDT(v.attempted_at)}</span>
      </span>
      <span className="flex flex-1 items-center gap-1.5 font-medium truncate">
        <User className="size-3.5 text-primary/50 shrink-0" />
        {v.agents?.full_name ?? "Unknown Agent"}
        {v.agents?.employee_id && (
          <span className="text-xs text-muted-foreground">({v.agents.employee_id})</span>
        )}
      </span>
      <span className="flex items-center gap-1.5 font-mono text-xs text-amber-400 shrink-0">
        <Globe className="size-3 shrink-0" />
        {v.ip_address ?? "—"}
      </span>
      {v.notes && (
        <span className="text-xs italic text-muted-foreground/60 truncate max-w-xs">
          {v.notes}
        </span>
      )}
    </li>
  );
}

export function ViolationsLogPanel() {
  const { data: violations = [], isLoading, refetch } = useAttendanceViolations();

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldAlert className="size-5 text-amber-400" />
            Blocked Clock-In Attempts
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Agents who tried to clock in from an unauthorized network.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="size-8 p-0"
          title="Refresh"
          onClick={() => void refetch()}
        >
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : violations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/30 bg-secondary/10 p-6 text-center">
          <ShieldAlert className="mx-auto mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No blocked attempts recorded.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/20">
          <div className="h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
          <ul className="divide-y divide-border/20">
            {violations.map((v) => (
              <ViolationRow key={v.id} v={v} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
