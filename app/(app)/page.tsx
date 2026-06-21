"use client";

import Link from "next/link";
import { useData, useRefreshOnMount } from "@/components/DataProvider";
import { Card, EmptyState, PageHeader, StatCard, Badge, money } from "@/components/ui";
import { fmtDate, hoursBetween } from "@/lib/dates";
import { statusTone } from "@/components/ui";

export default function Dashboard() {
  useRefreshOnMount();
  const { session, timeEntries, contracts, expenses, payroll } = useData();
  const isAdmin = session.user.role === "admin";

  const openShift = timeEntries.find((t) => !t.clockOut);
  const pendingContracts = contracts.filter((c) => c.status === "pending");
  const pendingExpenses = expenses.filter((e) => e.status === "pending");
  const pendingPayroll = payroll.filter((p) => p.status === "pending");

  // Hours this week (effective user, or all if admin).
  const weekHours = timeEntries
    .filter((t) => t.clockOut)
    .reduce((sum, t) => sum + hoursBetween(t.clockIn, t.clockOut!), 0);

  return (
    <div>
      <PageHeader
        title={`Welcome, ${session.user.name.split(" ")[0]}`}
        subtitle={isAdmin ? "Team overview" : "Your snapshot"}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Hours logged"
          value={weekHours.toFixed(1)}
          hint={isAdmin ? "All employees" : "Your total"}
          tone="blue"
        />
        <StatCard
          label="Pending contracts"
          value={pendingContracts.length}
          tone="amber"
        />
        <StatCard
          label="Pending expenses"
          value={pendingExpenses.length}
          tone="amber"
        />
        <StatCard
          label={isAdmin ? "Payroll pending" : "You're owed"}
          value={money(pendingPayroll.reduce((s, p) => s + p.gross, 0))}
          tone="green"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Time status" actions={<Link href="/time" className="text-xs text-brand-600">Open</Link>}>
          {openShift ? (
            <div className="flex items-center justify-between">
              <div>
                <Badge tone="green">Clocked in</Badge>
                <div className="text-sm text-slate-500 mt-2">
                  {openShift.project || "No project"} · since{" "}
                  {fmtDate(openShift.clockIn)}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Not clocked in.</p>
          )}
        </Card>

        <Card
          title={isAdmin ? "Contracts awaiting signature" : "Your contracts"}
          actions={<Link href="/contracts" className="text-xs text-brand-600">Open</Link>}
        >
          {pendingContracts.length === 0 ? (
            <EmptyState title="All clear" description="No pending contracts." />
          ) : (
            <ul className="space-y-2">
              {pendingContracts.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{c.title}</span>
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Recent expenses"
          actions={<Link href="/payroll" className="text-xs text-brand-600">Open</Link>}
        >
          {expenses.length === 0 ? (
            <EmptyState title="No expenses yet" />
          ) : (
            <ul className="space-y-2">
              {expenses.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {e.category || "Expense"} · {fmtDate(e.date)}
                  </span>
                  <span className="flex items-center gap-2">
                    {money(e.amount)}
                    <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Payroll"
          actions={<Link href="/payroll" className="text-xs text-brand-600">Open</Link>}
        >
          {payroll.length === 0 ? (
            <EmptyState title="No payroll entries" />
          ) : (
            <ul className="space-y-2">
              {payroll.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {isAdmin ? p.userName : "Period"} · {fmtDate(p.periodStart)}–
                    {fmtDate(p.periodEnd)}
                  </span>
                  <span className="flex items-center gap-2">
                    {money(p.gross)}
                    <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
