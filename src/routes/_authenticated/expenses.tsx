import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  DollarSign,
  TrendingDown,
  Calendar,
  Tag,
  CreditCard,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  useExpenses,
  useSaveExpense,
  useDeleteExpense,
  type OfficeExpense,
  type ExpensePayload,
} from "@/lib/queries";
import { formatDate, formatPKR, todayISO } from "@/lib/billzo";

export const Route = createFileRoute("/_authenticated/expenses")({
  component: ExpensesPage,
});

// ── constants ─────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  {
    value: "rent",
    label: "Office Rent",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    ring: "ring-violet-500/20",
  },
  {
    value: "utilities",
    label: "Utilities",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/20",
  },
  {
    value: "salaries",
    label: "Salaries / Payroll",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
  },
  {
    value: "equipment",
    label: "Equipment",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    ring: "ring-cyan-500/20",
  },
  {
    value: "internet",
    label: "Internet / Telecom",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    ring: "ring-sky-500/20",
  },
  {
    value: "marketing",
    label: "Marketing",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    ring: "ring-pink-500/20",
  },
  {
    value: "travel",
    label: "Travel",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
  },
  {
    value: "maintenance",
    label: "Maintenance",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    ring: "ring-orange-500/20",
  },
  {
    value: "supplies",
    label: "Office Supplies",
    color: "text-lime-400",
    bg: "bg-lime-500/10",
    ring: "ring-lime-500/20",
  },
  {
    value: "general",
    label: "General",
    color: "text-muted-foreground",
    bg: "bg-secondary/50",
    ring: "ring-border/40",
  },
];

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Credit Card", "Online"];

function catInfo(value: string) {
  return (
    EXPENSE_CATEGORIES.find((c) => c.value === value) ??
    EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]!
  );
}

function monthLabel(m: string) {
  return new Date(m).toLocaleDateString("en-PK", { month: "long", year: "numeric" });
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ── small form ────────────────────────────────────────────────────────────────

type FormState = {
  title: string;
  category: string;
  amount: string;
  expense_date: string;
  description: string;
  paid_to: string;
  payment_method: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  category: "general",
  amount: "",
  expense_date: todayISO(),
  description: "",
  paid_to: "",
  payment_method: "Cash",
};

function ExpenseFormDialog({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial?: Partial<FormState>;
  onSave: (f: FormState) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, ...initial });
  const set = (key: keyof FormState, val: string) => setForm((v) => ({ ...v, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!form.expense_date) {
      toast.error("Date is required");
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg animate-rise overflow-hidden rounded-3xl border border-white/8 bg-[#0d1420] shadow-2xl shadow-black/50">
        {/* accent line */}
        <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

        <div className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {initial?.title ? "Edit Expense" : "Add Expense"}
            </h2>
            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Title *
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Monthly Office Rent"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Category
                </label>
                <Select value={form.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Amount (PKR) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Date *
                </label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => set("expense_date", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Payment Method
                </label>
                <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Paid To
                </label>
                <Input
                  value={form.paid_to}
                  onChange={(e) => set("paid_to", e.target.value)}
                  placeholder="Vendor / payee name"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Description
                </label>
                <Input
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="gap-1.5 shadow-lg shadow-primary/20"
              >
                {saving ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Check className="size-4" />
                )}
                {initial?.title ? "Save Changes" : "Add Expense"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

function ExpensesPage() {
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();

  // Agents must not access this page
  if (!isStaff) {
    void navigate({ to: "/dashboard" });
    return null;
  }

  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<OfficeExpense | null>(null);

  const { data: expenses = [], isLoading, error } = useExpenses(selectedMonth);
  const save = useSaveExpense();
  const del = useDeleteExpense();

  // Month navigation
  const prevMonth = () => {
    const d = new Date(selectedMonth);
    d.setMonth(d.getMonth() - 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  };
  const nextMonth = () => {
    const d = new Date(selectedMonth);
    d.setMonth(d.getMonth() + 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    if (next <= currentMonth()) setSelectedMonth(next);
  };
  const isCurrentMonth = selectedMonth === currentMonth();

  // Totals
  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0);

  // Per-category totals
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      map[e.category] = (map[e.category] ?? 0) + Number(e.amount);
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, amt]) => ({ cat, amt }));
  }, [expenses]);

  const handleSave = async (form: FormState) => {
    const month = form.expense_date.slice(0, 7) + "-01";
    try {
      const baseValues: ExpensePayload = {
        title: form.title,
        category: form.category,
        amount: parseFloat(form.amount),
        expense_date: form.expense_date,
        month,
        description: form.description || null,
        paid_to: form.paid_to || null,
        payment_method: form.payment_method,
      };
      if (!editTarget) baseValues.created_by = user?.id ?? null;
      if (editTarget) {
        await save.mutateAsync({ id: editTarget.id, values: baseValues });
      } else {
        await save.mutateAsync({ values: baseValues });
      }
      toast.success(editTarget ? "Expense updated" : "Expense added");
      setShowForm(false);
      setEditTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save expense");
    }
  };

  const handleDelete = (e: OfficeExpense) => {
    if (!confirm(`Delete "${e.title}"? This cannot be undone.`)) return;
    del.mutate(e.id, {
      onSuccess: () => toast.success("Expense deleted"),
      onError: (err) => toast.error(err.message),
    });
  };

  // Show DB migration notice if table doesn't exist
  const needsMigration = error && String(error).includes("does not exist");

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <header className="animate-rise flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Office Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage monthly office expenditures.
          </p>
        </div>
        {isStaff && (
          <Button
            size="sm"
            onClick={() => {
              setEditTarget(null);
              setShowForm(true);
            }}
            className="gap-1.5 shadow-lg shadow-primary/20"
          >
            <Plus className="size-4" /> Add Expense
          </Button>
        )}
      </header>

      {/* ── Migration notice ── */}
      {needsMigration && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-400">Database table not set up yet</p>
            <p className="mt-0.5 text-muted-foreground">
              Run the migration{" "}
              <code className="rounded bg-secondary/50 px-1 py-0.5 font-mono text-xs">
                supabase/migrations/20260803_office_expenses.sql
              </code>{" "}
              in your Supabase SQL editor to create the{" "}
              <code className="rounded bg-secondary/50 px-1 py-0.5 font-mono text-xs">
                office_expenses
              </code>{" "}
              table.
            </p>
          </div>
        </div>
      )}

      {/* ── Month picker ── */}
      <div className="glass animate-rise flex items-center justify-between rounded-2xl px-5 py-4">
        <button
          onClick={prevMonth}
          className="grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Showing</p>
          <p className="mt-0.5 text-lg font-bold">{monthLabel(selectedMonth)}</p>
        </div>

        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className="animate-rise grid gap-4 sm:grid-cols-3">
        {/* Total */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
          <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary/60">
              <DollarSign className="size-3.5" /> Total This Month
            </div>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-primary">
              {formatPKR(totalAmount)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              {expenses.length} transaction{expenses.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Top category */}
        {byCategory[0] ? (
          <div
            className={`rounded-2xl border p-5 bg-gradient-to-br ${catInfo(byCategory[0].cat).bg} ${catInfo(byCategory[0].cat).ring} ring-1`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              <TrendingDown className="size-3.5" /> Biggest Expense
            </div>
            <p className={`mt-3 text-2xl font-bold ${catInfo(byCategory[0].cat).color}`}>
              {formatPKR(byCategory[0].amt)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              {catInfo(byCategory[0].cat).label}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/30 bg-secondary/15 p-5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              <TrendingDown className="size-3.5" /> Biggest Expense
            </div>
            <p className="mt-3 text-2xl font-bold text-muted-foreground/40">—</p>
          </div>
        )}

        {/* Category breakdown */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            <Tag className="size-3.5" /> By Category
          </div>
          {byCategory.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground/50">No data yet</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {byCategory.slice(0, 4).map(({ cat, amt }) => {
                const ci = catInfo(cat);
                const pct = totalAmount > 0 ? (amt / totalAmount) * 100 : 0;
                return (
                  <li key={cat} className="flex items-center gap-2 text-xs">
                    <span
                      className={`inline-block size-2 shrink-0 rounded-full ${ci.bg} ring-1 ${ci.ring}`}
                    />
                    <span className={`flex-1 truncate ${ci.color}`}>{ci.label}</span>
                    <span className="tabular-nums text-muted-foreground/70">{pct.toFixed(0)}%</span>
                    <span className={`font-semibold tabular-nums ${ci.color}`}>
                      {formatPKR(amt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Expenses list ── */}
      {isLoading ? (
        <div className="glass animate-rise flex items-center justify-center gap-3 rounded-2xl py-16 text-sm text-muted-foreground">
          <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading expenses…
        </div>
      ) : !needsMigration && expenses.length === 0 ? (
        <div className="glass animate-rise flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <FileText className="size-6 text-primary/60" />
          </span>
          <p className="font-medium">No expenses recorded</p>
          <p className="text-sm text-muted-foreground">
            Add your first expense for {monthLabel(selectedMonth)}.
          </p>
          {isStaff && (
            <Button size="sm" onClick={() => setShowForm(true)} className="mt-1 gap-1.5">
              <Plus className="size-4" /> Add Expense
            </Button>
          )}
        </div>
      ) : !needsMigration ? (
        <>
          {/* Desktop table */}
          <div className="glass animate-rise hidden overflow-hidden rounded-2xl md:block">
            <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-gradient-to-r from-secondary/60 via-secondary/40 to-secondary/60">
                    {["Title", "Category", "Date", "Paid To", "Payment", "Amount", "Actions"].map(
                      (h) => (
                        <th
                          key={h}
                          className={`px-4 py-3.5 ${h === "Actions" ? "text-right" : "text-left"}`}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                            {h}
                          </span>
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {expenses.map((e) => {
                    const ci = catInfo(e.category);
                    return (
                      <tr
                        key={e.id}
                        className="group transition-all duration-150 hover:bg-primary/[0.03]"
                      >
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-foreground/90">{e.title}</p>
                          {e.description && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground/60 italic">
                              {e.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ${ci.bg} ${ci.color} ${ci.ring}`}
                          >
                            <Tag className="size-3 opacity-60" />
                            {ci.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                            <Calendar className="size-3" />
                            {formatDate(e.expense_date)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground/70">
                          {e.paid_to ?? "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                            <CreditCard className="size-3 opacity-60" />
                            {e.payment_method ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-sm font-bold tabular-nums text-primary">
                            {formatPKR(Number(e.amount))}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg p-0 text-muted-foreground/60 hover:bg-primary/15 hover:text-primary"
                              onClick={() => {
                                setEditTarget(e);
                                setShowForm(true);
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg p-0 text-muted-foreground/40 hover:bg-destructive/15 hover:text-destructive"
                              onClick={() => handleDelete(e)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="animate-rise grid gap-3 md:hidden">
            {expenses.map((e) => {
              const ci = catInfo(e.category);
              return (
                <div key={e.id} className="glass relative overflow-hidden rounded-2xl p-4">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{e.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium ring-1 ${ci.bg} ${ci.color} ${ci.ring}`}
                        >
                          <Tag className="size-2.5" />
                          {ci.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground/60">
                          {formatDate(e.expense_date)}
                        </span>
                        {e.payment_method && (
                          <span className="text-[11px] text-muted-foreground/60">
                            {e.payment_method}
                          </span>
                        )}
                      </div>
                      {e.description && (
                        <p className="mt-1.5 text-xs text-muted-foreground/60 italic">
                          {e.description}
                        </p>
                      )}
                      {e.paid_to && (
                        <p className="mt-1 text-xs text-muted-foreground/60">To: {e.paid_to}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="font-mono text-lg font-bold text-primary">
                        {formatPKR(Number(e.amount))}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setEditTarget(e);
                            setShowForm(true);
                          }}
                          className="grid size-7 place-items-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-primary/15 hover:text-primary"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(e)}
                          className="grid size-7 place-items-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-destructive/15 hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {/* ── Form dialog ── */}
      {showForm && (
        <ExpenseFormDialog
          initial={
            editTarget
              ? {
                  title: editTarget.title,
                  category: editTarget.category,
                  amount: String(editTarget.amount),
                  expense_date: editTarget.expense_date,
                  description: editTarget.description ?? "",
                  paid_to: editTarget.paid_to ?? "",
                  payment_method: editTarget.payment_method ?? "Cash",
                }
              : ({} as Partial<FormState>)
          }
          onSave={(f: FormState) => {
            void handleSave(f);
          }}
          onClose={() => {
            setShowForm(false);
            setEditTarget(null);
          }}
          saving={save.isPending}
        />
      )}
    </div>
  );
}
