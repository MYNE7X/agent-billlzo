/**
 * MonthlySalesPanel — staff-only panel to add/edit/delete agent monthly sales.
 * Rendered inside the admin AgentDetail page.
 */
import { useState } from "react";
import { Plus, Trash2, TrendingUp, Pencil, Check, X, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  useAgentMonthlySales, useUpsertMonthlySale, useDeleteMonthlySale,
} from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";
import { formatPKR } from "@/lib/billzo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props { agentId: string }

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { month: "long", year: "numeric" });
}

export function MonthlySalesPanel({ agentId }: Props) {
  const { user } = useAuth();
  const { data: sales = [], isLoading, isError, error, refetch } = useAgentMonthlySales(agentId);
  const upsert = useUpsertMonthlySale();
  const del = useDeleteMonthlySale();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // form state
  const today = new Date();
  const [month, setMonth] = useState(monthKey(today).slice(0, 7)); // "YYYY-MM" for <input type="month">
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setMonth(monthKey(today).slice(0, 7));
    setAmount("");
    setNotes("");
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(row: { id: string; month: string; amount: number; notes: string | null }) {
    setEditId(row.id);
    setMonth(row.month.slice(0, 7));
    setAmount(String(row.amount));
    setNotes(row.notes ?? "");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!month || isNaN(amt) || amt < 0) {
      toast.error("Enter a valid month and amount");
      return;
    }
    try {
      await upsert.mutateAsync({
        agentId,
        month: month + "-01",
        amount: amt,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        createdBy: user?.id ?? null,
      });
      toast.success(editId ? "Sales updated" : "Sales entry added");
      resetForm();
    } catch (err) {
      // Show actual Supabase error so it's easier to diagnose
      const msg = err instanceof Error ? err.message : "Could not save";
      console.error("[MonthlySalesPanel] save error:", err);
      toast.error(msg);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this sales record?")) return;
    try {
      await del.mutateAsync({ id, agentId });
      toast.success("Deleted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      console.error("[MonthlySalesPanel] delete error:", err);
      toast.error(msg);
    }
  }

  const total = sales.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-5">

      {/* summary */}
      {sales.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Total Sales", value: formatPKR(total), color: "text-emerald-400" },
            { label: "Best Month", value: formatPKR(Math.max(...sales.map((s) => Number(s.amount)))), color: "text-primary" },
            { label: "Avg / Month", value: formatPKR(total / sales.length), color: "text-amber-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border/30 bg-secondary/20 p-4 text-center">
              <TrendingUp className={`mx-auto mb-1.5 size-4 ${s.color} opacity-60`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* add/edit form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
          <p className="text-sm font-semibold">{editId ? "Edit Sales Entry" : "Add Monthly Sales"}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Month</Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount (PKR ₨)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 150000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Notes (optional)</Label>
              <Input
                placeholder="Any remarks"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={resetForm} disabled={upsert.isPending}>
              <X className="size-3.5" /> Cancel
            </Button>
            <Button type="submit" size="sm" disabled={upsert.isPending}>
              <Check className="size-3.5" /> {editId ? "Save Changes" : "Add Entry"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="size-3.5" /> Add Monthly Sales
          </Button>
        </div>
      )}

      {/* table */}
      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading sales data…</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 py-8 px-4 text-center">
          <AlertCircle className="size-6 text-destructive/70" />
          <div>
            <p className="font-medium text-sm text-destructive/90">Could not load sales data</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "Check your connection or Supabase RLS settings."}
            </p>
          </div>
          <button
            onClick={() => void refetch()}
            className="flex items-center gap-1.5 rounded-lg bg-secondary/40 px-4 py-1.5 text-xs font-medium hover:bg-secondary/70 transition-colors"
          >
            <RefreshCw className="size-3.5" /> Retry
          </button>
        </div>
      ) : sales.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No sales entries yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  {["Month", "Amount (PKR)", "Notes", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {sales.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-secondary/20">
                    <td className="px-4 py-3 font-medium">{monthLabel(row.month)}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">{formatPKR(Number(row.amount))}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{row.notes ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => startEdit({ id: row.id, month: row.month, amount: Number(row.amount), notes: row.notes })}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                          title="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          disabled={del.isPending}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
