/**
 * SalaryManagementPanel — admin panel to set salary, add deductions/bonuses.
 * Rendered inside the admin AgentDetail page.
 */
import { useState } from "react";
import {
  Banknote, Plus, Trash2, Pencil, Check, X, TrendingDown, TrendingUp, Minus,
} from "lucide-react";
import { toast } from "sonner";

import {
  useAgentSalaryLedger,
  useUpsertSalaryEntry,
  useDeleteSalaryEntry,
  useSaveAgent,
  type SalaryEntry,
} from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";
import { formatPKR } from "@/lib/billzo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  agentId: string;
  baseSalary?: number | null;
}

type EntryType = "deduction" | "bonus";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-PK", {
    month: "long",
    year: "numeric",
  });
}

const TYPE_META: Record<EntryType, { label: string; color: string; bg: string; icon: typeof TrendingDown }> = {
  deduction: { label: "Deduction", color: "text-red-400", bg: "bg-red-500/10", icon: TrendingDown },
  bonus:     { label: "Bonus",     color: "text-emerald-400", bg: "bg-emerald-500/10", icon: TrendingUp },
};

export function SalaryManagementPanel({ agentId, baseSalary }: Props) {
  const { user } = useAuth();
  const today = new Date();

  // month picker (YYYY-MM for input, YYYY-MM-01 for DB)
  const [selectedMonth, setSelectedMonth] = useState(monthKey(today).slice(0, 7));
  const dbMonth = selectedMonth + "-01";

  const { data: entries = [], isLoading } = useAgentSalaryLedger(agentId, dbMonth);
  const upsert   = useUpsertSalaryEntry();
  const del      = useDeleteSalaryEntry();
  const saveAgent = useSaveAgent();

  // base salary edit
  const [editingBase, setEditingBase] = useState(false);
  const [baseInput, setBaseInput] = useState(String(baseSalary ?? 0));

  // entry form
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<SalaryEntry | null>(null);
  const [entryType, setEntryType] = useState<EntryType>("deduction");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");

  function resetForm() {
    setShowForm(false);
    setEditEntry(null);
    setAmount("");
    setRemarks("");
    setEntryType("deduction");
  }

  function startEditEntry(e: SalaryEntry) {
    setEditEntry(e);
    setEntryType(e.entry_type as EntryType);
    setAmount(String(e.amount));
    setRemarks(e.remarks ?? "");
    setShowForm(true);
  }

  async function saveBase(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(baseInput);
    if (isNaN(val) || val < 0) { toast.error("Enter a valid salary"); return; }
    try {
      await saveAgent.mutateAsync({ id: agentId, values: { salary: val } as never });
      toast.success("Base salary updated");
      setEditingBase(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update salary");
    }
  }

  async function handleEntry(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    try {
      await upsert.mutateAsync({
        ...(editEntry?.id ? { id: editEntry.id } : {}),
        agentId,
        month: dbMonth,
        entry_type: entryType,
        amount: amt,
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
        createdBy: user?.id ?? null,
      });
      toast.success(editEntry ? "Entry updated" : "Entry added");
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function handleDelete(entry: SalaryEntry) {
    if (!confirm(`Delete this ${entry.entry_type}?`)) return;
    try {
      await del.mutateAsync({ id: entry.id, agentId });
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  // net calculation for selected month
  const base = baseSalary ?? 0;
  const totalDeductions = entries
    .filter((e) => e.entry_type === "deduction")
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalBonuses = entries
    .filter((e) => e.entry_type === "bonus")
    .reduce((s, e) => s + Number(e.amount), 0);
  const netPay = base - totalDeductions + totalBonuses;

  return (
    <div className="space-y-5">

      {/* ── Base Salary Card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
        <div className="absolute -right-8 -top-8 size-32 rounded-full bg-primary/8 blur-2xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary/60">
              <Banknote className="size-3.5" /> Base Monthly Salary
            </p>
            {editingBase ? (
              <form onSubmit={saveBase} className="mt-3 flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={baseInput}
                  onChange={(e) => setBaseInput(e.target.value)}
                  className="w-40 font-mono text-lg"
                  autoFocus
                />
                <Button type="submit" size="sm" disabled={saveAgent.isPending}>
                  <Check className="size-3.5" /> Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setBaseInput(String(baseSalary ?? 0)); setEditingBase(false); }}
                >
                  <X className="size-3.5" />
                </Button>
              </form>
            ) : (
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-primary">
                {formatPKR(base)}
              </p>
            )}
          </div>
          {!editingBase && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => { setBaseInput(String(baseSalary ?? 0)); setEditingBase(true); }}
            >
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
        </div>
      </div>

      {/* ── Month selector + Net summary ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">Month</Label>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-40"
          />
        </div>

        {/* net pay pill */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
            <TrendingDown className="size-3.5" /> Deductions: {formatPKR(totalDeductions)}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            <TrendingUp className="size-3.5" /> Bonuses: {formatPKR(totalBonuses)}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <Banknote className="size-3.5" /> Net: {formatPKR(netPay)}
          </span>
        </div>
      </div>

      {/* ── Add / Edit Form ── */}
      {showForm ? (
        <form onSubmit={handleEntry} className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
          <p className="text-sm font-semibold">{editEntry ? "Edit Entry" : "Add Salary Entry"}</p>

          {/* type selector */}
          {!editEntry && (
            <div className="flex gap-2">
              {(["deduction", "bonus"] as EntryType[]).map((t) => {
                const m = TYPE_META[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEntryType(t)}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                      entryType === t
                        ? `border-current ${m.color} ${m.bg}`
                        : "border-border/40 text-muted-foreground hover:border-border hover:bg-secondary/30"
                    }`}
                  >
                    <m.icon className="size-4" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Amount (PKR ₨)
              </Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="e.g. 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus={!editEntry}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Remarks
              </Label>
              <Input
                placeholder={entryType === "deduction" ? "e.g. Absent 2 days" : "e.g. Sales performance bonus"}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={resetForm} disabled={upsert.isPending}>
              <X className="size-3.5" /> Cancel
            </Button>
            <Button type="submit" size="sm" disabled={upsert.isPending}>
              <Check className="size-3.5" /> {editEntry ? "Save Changes" : "Add Entry"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="size-3.5" /> Add Deduction / Bonus
          </Button>
        </div>
      )}

      {/* ── Ledger Table ── */}
      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 bg-secondary/10 py-10 text-center">
          <Minus className="mx-auto mb-2 size-6 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No deductions or bonuses for {monthLabel(dbMonth)}.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/60">
            Net pay = Base Salary ({formatPKR(base)})
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50">
          {/* net pay bar */}
          <div className="flex items-center justify-between border-b border-border/30 bg-secondary/20 px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {monthLabel(dbMonth)} — Net Pay
            </span>
            <span className="font-bold tabular-nums text-primary">{formatPKR(netPay)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  {["Type", "Amount (PKR)", "Remarks", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {entries.map((row) => {
                  const m = TYPE_META[row.entry_type as EntryType];
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-secondary/20">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${m?.bg ?? ""} ${m?.color ?? ""}`}>
                          {m && <m.icon className="size-3" />}
                          {m?.label ?? row.entry_type}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-semibold tabular-nums ${m?.color ?? ""}`}>
                        {row.entry_type === "deduction" ? "−" : "+"} {formatPKR(Number(row.amount))}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{row.remarks ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => startEditEntry(row)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(row)}
                            disabled={del.isPending}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
