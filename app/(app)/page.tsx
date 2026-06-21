"use client";

import Link from "next/link";
import { useState } from "react";
import { useData, useRefreshOnMount } from "@/components/DataProvider";
import { Button, Card, EmptyState, PageHeader, StatCard, Badge, money } from "@/components/ui";
import { fmtDate, hoursBetween } from "@/lib/dates";
import { statusTone } from "@/components/ui";

export default function Dashboard() {
  useRefreshOnMount();
  const { session, users, timeEntries, contracts, expenses, payroll, refreshData } =
    useData();
  const isAdmin = session.user.role === "admin";
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  async function loadDemo() {
    setSeeding(true);
    setSeedMsg(null);
    const res = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    setSeeding(false);
    if (data.alreadySeeded) setSeedMsg("Sample data already loaded.");
    else if (data.seeded) setSeedMsg("Sample data loaded across all sections.");
    else setSeedMsg(data.error || "Could not load sample data.");
    await refreshData();
  }

  // Show the demo helper only while the workspace is essentially empty (admin
  // only): no employees and no records yet. It hides once real data exists.
  const employeeCount = users.filter((u) => u.role !== "admin").length;
  const isEmptyWorkspace =
    employeeCount === 0 &&
    timeEntries.length === 0 &&
    expenses.length === 0 &&
    payroll.length === 0 &&
    contracts.length === 0;
  const showDemoButton = isAdmin && isEmptyWorkspace;

  const openShift = timeEntries.find((t) => !t.clockOut);
  const pendingContracts = contracts.filter((c) => c.status === "pending");
  const pendingExpenses = expenses.filter((e) => e.status === "pending");
  const pendingPayroll = payroll.filter((p) => p.status === "pending");

  // Hours this week (effective user, or all if admin).
  const weekHours = timeEntries
    .filter((t) => t.clockOut)
    .reduce((sum, t) => sum + hoursBetween(t.clockIn, t.clockOut!), 0);

  return (
    <div className="animate-fade-up">
      {/* Gradient hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-600 to-violet-600 text-white p-6 lg:p-8 mb-6 shadow-card">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute right-16 bottom-0 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">
              Welcome back, {session.user.name.split(" ")[0]} 👋
            </h1>
            <p className="text-white/80 text-sm mt-1">
              {isAdmin
                ? "Here's how the team is doing today."
                : "Here's your snapshot for today."}
            </p>
          </div>
          {showDemoButton && (
            <div className="text-right">
              <Button
                variant="secondary"
                onClick={loadDemo}
                disabled={seeding}
                className="bg-white/95"
              >
                {seeding ? "Loading…" : "✨ Load sample data"}
              </Button>
              <p className="text-[11px] text-white/70 mt-1">
                Optional — fills sections with demo records you can delete later.
              </p>
              {seedMsg && <p className="text-xs text-white/90 mt-1">{seedMsg}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Hours logged"
          value={weekHours.toFixed(1)}
          hint={isAdmin ? "All employees" : "Your total"}
          tone="blue"
          icon="◷"
        />
        <StatCard
          label="Pending contracts"
          value={pendingContracts.length}
          tone="amber"
          icon="✎"
        />
        <StatCard
          label="Pending expenses"
          value={pendingExpenses.length}
          tone="amber"
          icon="$"
        />
        <StatCard
          label={isAdmin ? "Payroll pending" : "You're owed"}
          value={money(pendingPayroll.reduce((s, p) => s + p.gross, 0))}
          tone="green"
          icon="◎"
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
