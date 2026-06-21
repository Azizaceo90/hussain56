"use client";

import { useMemo, useState } from "react";
import { useData, useRefreshOnMount } from "@/components/DataProvider";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  Textarea,
  cx,
  money,
  statusTone,
} from "@/components/ui";
import { fmtDate, hoursBetween, weekEnd, weekKey, weekStart } from "@/lib/dates";
import type { Expense, PayrollEntry, TimeEntry } from "@/lib/types";

export default function PayrollPage() {
  useRefreshOnMount();
  const { session } = useData();
  const isAdmin = session.user.role === "admin";
  const [tab, setTab] = useState<"expenses" | "payroll">("expenses");

  return (
    <div>
      <PageHeader title="Payroll & Expenses" subtitle="Reimbursements and pay runs" />
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <TabBtn active={tab === "expenses"} onClick={() => setTab("expenses")}>
          Expenses
        </TabBtn>
        <TabBtn active={tab === "payroll"} onClick={() => setTab("payroll")}>
          Payroll
        </TabBtn>
      </div>
      {tab === "expenses" ? <ExpensesTab isAdmin={isAdmin} /> : <PayrollTab isAdmin={isAdmin} />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
        active ? "bg-white shadow-sm text-slate-800" : "text-slate-500"
      )}
    >
      {children}
    </button>
  );
}

// --------------------------------------------------------------------------
// Expenses
// --------------------------------------------------------------------------
function ExpensesTab({ isAdmin }: { isAdmin: boolean }) {
  const { session, expenses, add, update, remove } = useData();
  const [open, setOpen] = useState(false);

  const totals = useMemo(() => {
    const t = { pending: 0, approved: 0, reimbursed: 0 };
    for (const e of expenses) {
      if (e.status === "pending") t.pending += e.amount;
      else if (e.status === "approved") t.approved += e.amount;
      else if (e.status === "reimbursed") t.reimbursed += e.amount;
    }
    return t;
  }, [expenses]);

  async function setStatus(e: Expense, status: Expense["status"]) {
    update("expenses", e.id, { status });
    await fetch(`/api/expenses/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function del(e: Expense) {
    if (!confirm("Delete this expense?")) return;
    remove("expenses", e.id);
    await fetch(`/api/expenses/${e.id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Pending" value={money(totals.pending)} tone="amber" />
        <StatCard label="Approved" value={money(totals.approved)} tone="green" />
        <StatCard label="Reimbursed" value={money(totals.reimbursed)} tone="blue" />
      </div>

      <Card
        title="Expenses"
        actions={<Button size="sm" onClick={() => setOpen(true)}>Submit expense</Button>}
      >
        {expenses.length === 0 ? (
          <EmptyState title="No expenses" description="Submit your first expense." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  {isAdmin && <th className="py-2 pr-4 font-medium">Who</th>}
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Amount</th>
                  <th className="py-2 pr-4 font-medium">Receipt</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2.5 pr-4 text-slate-600">{fmtDate(e.date)}</td>
                    {isAdmin && (
                      <td className="py-2.5 pr-4 text-slate-600">{e.userName || "—"}</td>
                    )}
                    <td className="py-2.5 pr-4">
                      <div className="text-slate-700">{e.category || "—"}</div>
                      {e.description && (
                        <div className="text-xs text-slate-400">{e.description}</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-slate-800">
                      {money(e.amount)}
                    </td>
                    <td className="py-2.5 pr-4">
                      {e.receiptUrl ? (
                        <a
                          href={e.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-600 text-xs underline"
                        >
                          {e.receiptName || "View"}
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin ? (
                          <>
                            {e.status === "pending" && (
                              <>
                                <Button size="sm" variant="success" onClick={() => setStatus(e, "approved")}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setStatus(e, "rejected")}>
                                  <span className="text-rose-600">Reject</span>
                                </Button>
                              </>
                            )}
                            {e.status === "approved" && (
                              <Button size="sm" onClick={() => setStatus(e, "reimbursed")}>
                                Mark reimbursed
                              </Button>
                            )}
                          </>
                        ) : (
                          e.status === "pending" &&
                          e.userId === session.user.id && (
                            <Button size="sm" variant="ghost" onClick={() => del(e)}>
                              <span className="text-rose-600">Delete</span>
                            </Button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && <ExpenseModal onClose={() => setOpen(false)} onAdded={(x) => add("expenses", x)} />}
    </div>
  );
}

function ExpenseModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (e: Expense) => void;
}) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "",
    amount: "",
    description: "",
  });
  const [receipt, setReceipt] = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file?: File) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("Receipt must be under 4MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setReceipt({ url: reader.result as string, name: file.name });
    reader.readAsDataURL(file);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
        receiptUrl: receipt?.url,
        receiptName: receipt?.name,
      }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed");
      return;
    }
    onAdded(data.item);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Submit expense"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Submitting…" : "Submit"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Input
            label="Amount (USD)"
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </div>
        <Input
          label="Category"
          placeholder="Travel, Supplies…"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <Textarea
          label="Description"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            Receipt (PDF/image, optional)
          </span>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="text-sm"
          />
          {receipt && <p className="text-xs text-emerald-600 mt-1">Attached: {receipt.name}</p>}
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------------------
// Payroll
// --------------------------------------------------------------------------
function PayrollTab({ isAdmin }: { isAdmin: boolean }) {
  const { payroll } = useData();
  const pending = payroll.filter((p) => p.status === "pending");
  const paid = payroll.filter((p) => p.status === "paid");

  return (
    <div className="space-y-6">
      {isAdmin && <AwaitingPayrollPanel />}
      {isAdmin && <PayrollActions />}

      <Card title="Pending payroll">
        <PayrollList entries={pending} isAdmin={isAdmin} />
      </Card>

      <Card title="Paid">
        <PayrollList entries={paid} isAdmin={isAdmin} paid />
      </Card>
    </div>
  );
}

function PayrollList({
  entries,
  isAdmin,
  paid,
}: {
  entries: PayrollEntry[];
  isAdmin: boolean;
  paid?: boolean;
}) {
  const { update, remove } = useData();
  if (entries.length === 0)
    return <EmptyState title={paid ? "Nothing paid yet" : "No pending payroll"} />;

  async function markPaid(p: PayrollEntry) {
    const paidAt = new Date().toISOString();
    update("payroll", p.id, { status: "paid", paidAt });
    await fetch(`/api/payroll/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid", paidAt }),
    });
  }

  async function del(p: PayrollEntry) {
    if (!confirm("Delete this payroll entry?")) return;
    remove("payroll", p.id);
    await fetch(`/api/payroll/${p.id}`, { method: "DELETE" });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
            {isAdmin && <th className="py-2 pr-4 font-medium">Employee</th>}
            <th className="py-2 pr-4 font-medium">Period</th>
            <th className="py-2 pr-4 font-medium">Hours</th>
            <th className="py-2 pr-4 font-medium">Rate</th>
            <th className="py-2 pr-4 font-medium">Gross</th>
            {paid && <th className="py-2 pr-4 font-medium">Paid</th>}
            {isAdmin && <th className="py-2 pr-4 font-medium text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {entries.map((p) => (
            <tr key={p.id}>
              {isAdmin && <td className="py-2.5 pr-4 text-slate-700">{p.userName || "—"}</td>}
              <td className="py-2.5 pr-4 text-slate-600">
                {fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}
              </td>
              <td className="py-2.5 pr-4 text-slate-600">{p.hours.toFixed(1)}</td>
              <td className="py-2.5 pr-4 text-slate-600">${p.rate}/hr</td>
              <td className="py-2.5 pr-4 font-medium text-slate-800">{money(p.gross)}</td>
              {paid && (
                <td className="py-2.5 pr-4 text-slate-500">
                  {p.paidAt ? fmtDate(p.paidAt) : "—"}
                </td>
              )}
              {isAdmin && (
                <td className="py-2.5 pr-4">
                  <div className="flex items-center justify-end gap-1">
                    {!paid && (
                      <Button size="sm" variant="success" onClick={() => markPaid(p)}>
                        Mark paid
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => del(p)}>
                      <span className="text-rose-600">Delete</span>
                    </Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Derive each employee's approved-or-submitted week not yet in payroll.
function useAwaitingWeeks() {
  const { users, timeEntries, payroll } = useData();
  return useMemo(() => {
    const groups = new Map<
      string,
      {
        userId: string;
        userName: string;
        rate: number;
        weekStart: Date;
        weekEnd: Date;
        hours: number;
      }
    >();
    for (const e of timeEntries as TimeEntry[]) {
      if (!e.submittedAt || !e.clockOut) continue;
      const wk = weekKey(new Date(e.clockIn));
      const key = `${e.userId}:${wk}`;
      if (!groups.has(key)) {
        const u = users.find((x) => x.id === e.userId);
        groups.set(key, {
          userId: e.userId,
          userName: u?.name || "Employee",
          rate: u?.payRate ?? 0,
          weekStart: weekStart(new Date(e.clockIn)),
          weekEnd: weekEnd(new Date(e.clockIn)),
          hours: 0,
        });
      }
      groups.get(key)!.hours += hoursBetween(e.clockIn, e.clockOut);
    }
    // Drop weeks already represented in payroll (same user + overlapping period start).
    const existing = new Set(
      payroll.map((p) => `${p.userId}:${weekKey(new Date(p.periodStart))}`)
    );
    return [...groups.entries()]
      .filter(([key]) => {
        const [userId] = key.split(":");
        const wk = key.split(":")[1];
        return !existing.has(`${userId}:${wk}`);
      })
      .map(([, v]) => v);
  }, [users, timeEntries, payroll]);
}

function AwaitingPayrollPanel() {
  const { add } = useData();
  const awaiting = useAwaitingWeeks();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function create(w: ReturnType<typeof useAwaitingWeeks>[number]) {
    const key = `${w.userId}:${w.weekStart.toISOString()}`;
    setBusyKey(key);
    const res = await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: w.userId,
        userName: w.userName,
        periodStart: w.weekStart.toISOString(),
        periodEnd: w.weekEnd.toISOString(),
        hours: Math.round(w.hours * 100) / 100,
        rate: w.rate,
      }),
    });
    setBusyKey(null);
    if (res.ok) {
      const { item } = await res.json();
      add("payroll", item);
    }
  }

  return (
    <Card title="Timesheets awaiting payroll">
      {awaiting.length === 0 ? (
        <EmptyState
          title="Nothing awaiting"
          description="Submitted weeks not yet in payroll will appear here."
        />
      ) : (
        <div className="space-y-2">
          {awaiting.map((w) => {
            const key = `${w.userId}:${w.weekStart.toISOString()}`;
            return (
              <div
                key={key}
                className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2.5"
              >
                <div className="text-sm">
                  <span className="font-medium text-slate-800">{w.userName}</span>
                  <span className="text-slate-500">
                    {" "}
                    · week of {fmtDate(w.weekStart)} · {w.hours.toFixed(1)}h ·{" "}
                    {w.rate ? `$${w.rate}/hr` : "no rate set"}
                  </span>
                </div>
                <Button size="sm" onClick={() => create(w)} disabled={busyKey === key}>
                  Create entry
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function PayrollActions() {
  const [runOpen, setRunOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  return (
    <div className="flex gap-2">
      <Button onClick={() => setRunOpen(true)}>Run payroll</Button>
      <Button variant="secondary" onClick={() => setAddOpen(true)}>
        Add entry
      </Button>
      {runOpen && <RunPayrollModal onClose={() => setRunOpen(false)} />}
      {addOpen && <AddEntryModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function RunPayrollModal({ onClose }: { onClose: () => void }) {
  const { users, timeEntries, add } = useData();
  const [period, setPeriod] = useState({
    start: weekStart(new Date()).toISOString().slice(0, 10),
    end: weekEnd(new Date()).toISOString().slice(0, 10),
  });
  const employees = users.filter((u) => u.role === "employee");

  // Editable rows of approved hours per employee within the chosen period.
  const [rows, setRows] = useState(() =>
    employees.map((u) => ({ userId: u.id, userName: u.name, hours: "", rate: u.payRate?.toString() || "" }))
  );
  const [busy, setBusy] = useState(false);

  function recomputeHours() {
    const start = new Date(period.start + "T00:00:00.000Z").getTime();
    const end = new Date(period.end + "T23:59:59.999Z").getTime();
    setRows((rs) =>
      rs.map((r) => {
        const hours = timeEntries
          .filter(
            (e) =>
              e.userId === r.userId &&
              e.clockOut &&
              new Date(e.clockIn).getTime() >= start &&
              new Date(e.clockIn).getTime() <= end
          )
          .reduce((s, e) => s + hoursBetween(e.clockIn, e.clockOut!), 0);
        return { ...r, hours: hours ? hours.toFixed(2) : "" };
      })
    );
  }

  async function run() {
    setBusy(true);
    const entries = rows
      .filter((r) => Number(r.hours) > 0 && r.rate !== "")
      .map((r) => ({
        userId: r.userId,
        userName: r.userName,
        hours: Number(r.hours),
        rate: Number(r.rate),
      }));
    const res = await fetch("/api/payroll/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodStart: new Date(period.start + "T00:00:00.000Z").toISOString(),
        periodEnd: new Date(period.end + "T23:59:59.999Z").toISOString(),
        entries,
      }),
    });
    setBusy(false);
    if (res.ok) {
      const { items } = await res.json();
      items.forEach((it: PayrollEntry) => add("payroll", it));
      onClose();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Run payroll"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={run} disabled={busy}>
            {busy ? "Creating…" : "Create entries"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 items-end">
          <Input
            label="Period start"
            type="date"
            value={period.start}
            onChange={(e) => setPeriod({ ...period, start: e.target.value })}
          />
          <Input
            label="Period end"
            type="date"
            value={period.end}
            onChange={(e) => setPeriod({ ...period, end: e.target.value })}
          />
          <Button variant="secondary" onClick={recomputeHours}>
            Load approved hours
          </Button>
        </div>
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
          {rows.map((r, i) => (
            <div key={r.userId} className="flex items-center gap-3 px-3 py-2">
              <span className="flex-1 text-sm text-slate-700">{r.userName}</span>
              <input
                className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                placeholder="hours"
                value={r.hours}
                onChange={(e) =>
                  setRows((rs) => rs.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))
                }
              />
              <input
                className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                placeholder="rate"
                value={r.rate}
                onChange={(e) =>
                  setRows((rs) => rs.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))
                }
              />
              <span className="w-20 text-right text-sm font-medium text-slate-700">
                {money(Number(r.hours || 0) * Number(r.rate || 0))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function AddEntryModal({ onClose }: { onClose: () => void }) {
  const { users, timeEntries, add } = useData();
  const employees = users.filter((u) => u.role === "employee");
  const [form, setForm] = useState({
    userId: employees[0]?.id || "",
    start: weekStart(new Date()).toISOString().slice(0, 10),
    end: weekEnd(new Date()).toISOString().slice(0, 10),
    hours: "",
    rate: employees[0]?.payRate?.toString() || "",
  });
  const [busy, setBusy] = useState(false);

  function useApprovedHours() {
    const start = new Date(form.start + "T00:00:00.000Z").getTime();
    const end = new Date(form.end + "T23:59:59.999Z").getTime();
    const hours = timeEntries
      .filter(
        (e) =>
          e.userId === form.userId &&
          e.clockOut &&
          new Date(e.clockIn).getTime() >= start &&
          new Date(e.clockIn).getTime() <= end
      )
      .reduce((s, e) => s + hoursBetween(e.clockIn, e.clockOut!), 0);
    setForm((f) => ({ ...f, hours: hours.toFixed(2) }));
  }

  function pickEmployee(userId: string) {
    const u = users.find((x) => x.id === userId);
    setForm((f) => ({ ...f, userId, rate: u?.payRate?.toString() || f.rate }));
  }

  async function save() {
    setBusy(true);
    const u = users.find((x) => x.id === form.userId);
    const res = await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: form.userId,
        userName: u?.name,
        periodStart: new Date(form.start + "T00:00:00.000Z").toISOString(),
        periodEnd: new Date(form.end + "T23:59:59.999Z").toISOString(),
        hours: Number(form.hours),
        rate: Number(form.rate),
      }),
    });
    setBusy(false);
    if (res.ok) {
      const { item } = await res.json();
      add("payroll", item);
      onClose();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add payroll entry"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Add entry"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select label="Employee" value={form.userId} onChange={(e) => pickEmployee(e.target.value)}>
          {employees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Period start"
            type="date"
            value={form.start}
            onChange={(e) => setForm({ ...form, start: e.target.value })}
          />
          <Input
            label="Period end"
            type="date"
            value={form.end}
            onChange={(e) => setForm({ ...form, end: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Hours"
            type="number"
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
          />
          <Input
            label="Rate (USD/hour)"
            type="number"
            value={form.rate}
            onChange={(e) => setForm({ ...form, rate: e.target.value })}
          />
        </div>
        <Button size="sm" variant="ghost" onClick={useApprovedHours}>
          Use approved hours from Time Tracker
        </Button>
      </div>
    </Modal>
  );
}
