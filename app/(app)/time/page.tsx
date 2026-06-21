"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useData, useRefreshOnMount } from "@/components/DataProvider";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Select,
  StatCard,
  Textarea,
} from "@/components/ui";
import { fmtDate, fmtTime, hoursBetween, weekKey, weekStart } from "@/lib/dates";
import { projectsForUser } from "@/lib/projects";
import type { TimeEntry } from "@/lib/types";

export default function TimePage() {
  useRefreshOnMount();
  const router = useRouter();
  const { session, users, timeEntries, add, update } = useData();
  const isAdmin = session.user.role === "admin";

  const me = users.find((u) => u.id === session.user.id);
  const projects = me ? projectsForUser(me) : ["General"];

  const [project, setProject] = useState(projects[0] ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const openShift = timeEntries.find(
    (t) => t.userId === session.user.id && !t.clockOut
  );

  async function clockIn() {
    setBusy(true);
    const res = await fetch("/api/timeEntries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clockIn: new Date().toISOString(), project, note }),
    });
    setBusy(false);
    if (res.ok) {
      const { item } = await res.json();
      add("timeEntries", item);
      setNote("");
    }
  }

  async function clockOut() {
    if (!openShift) return;
    setBusy(true);
    const res = await fetch(`/api/timeEntries/${openShift.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clockOut: new Date().toISOString() }),
    });
    setBusy(false);
    if (res.ok) {
      update("timeEntries", openShift.id, { clockOut: new Date().toISOString() });
    }
  }

  // Group the effective user's own entries by week for the timesheet view.
  const myEntries = timeEntries.filter((t) => t.userId === session.user.id);
  const myWeeks = groupByWeek(myEntries);

  const totalHours = myEntries
    .filter((t) => t.clockOut)
    .reduce((s, t) => s + hoursBetween(t.clockIn, t.clockOut!), 0);

  return (
    <div>
      <PageHeader title="Time Tracker" subtitle="Clock in/out and submit weekly timesheets" />

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <Card title="Clock">
            {openShift ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Badge tone="green">Clocked in</Badge>
                  <div className="text-sm text-slate-600 mt-2">
                    {openShift.project || "No project"} · since{" "}
                    {fmtTime(openShift.clockIn)} {fmtDate(openShift.clockIn)}
                  </div>
                </div>
                <Button variant="danger" onClick={clockOut} disabled={busy}>
                  Clock out
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Select
                  label="Project"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
                <Textarea
                  label="Note (optional)"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button variant="success" onClick={clockIn} disabled={busy}>
                  Clock in
                </Button>
              </div>
            )}
          </Card>
        </div>
        <StatCard
          label="Total hours"
          value={totalHours.toFixed(1)}
          hint="Completed shifts"
          tone="blue"
        />
      </div>

      <Card title="My weekly timesheets">
        {myWeeks.length === 0 ? (
          <EmptyState title="No time entries yet" description="Clock in to start tracking." />
        ) : (
          <div className="space-y-4">
            {myWeeks.map((w) => (
              <WeekBlock
                key={w.key}
                week={w}
                onSubmitted={() => router.refresh()}
              />
            ))}
          </div>
        )}
      </Card>

      {isAdmin && <AdminApprovalPanel />}
    </div>
  );
}

type Week = { key: string; start: Date; entries: TimeEntry[] };

function groupByWeek(entries: TimeEntry[]): Week[] {
  const map = new Map<string, Week>();
  for (const e of entries) {
    const key = weekKey(new Date(e.clockIn));
    if (!map.has(key))
      map.set(key, { key, start: weekStart(new Date(e.clockIn)), entries: [] });
    map.get(key)!.entries.push(e);
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

function WeekBlock({ week, onSubmitted }: { week: Week; onSubmitted: () => void }) {
  const { update } = useData();
  const [busy, setBusy] = useState(false);

  const hours = week.entries
    .filter((e) => e.clockOut)
    .reduce((s, e) => s + hoursBetween(e.clockIn, e.clockOut!), 0);
  const submitted = week.entries.some((e) => e.submittedAt);
  const approved = week.entries.length > 0 && week.entries.every((e) => e.approvedAt);
  const hasOpen = week.entries.some((e) => !e.clockOut);

  async function submit() {
    setBusy(true);
    const res = await fetch("/api/timesheets/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekOf: week.start.toISOString() }),
    });
    setBusy(false);
    if (res.ok) {
      const now = new Date().toISOString();
      week.entries.forEach((e) => {
        if (e.clockOut) update("timeEntries", e.id, { submittedAt: now });
      });
      onSubmitted();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Submit failed");
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-t-lg">
        <div className="text-sm font-medium text-slate-700">
          Week of {fmtDate(week.start)} · {hours.toFixed(1)}h
        </div>
        <div className="flex items-center gap-2">
          {approved ? (
            <Badge tone="green">Approved</Badge>
          ) : submitted ? (
            <Badge tone="blue">Submitted</Badge>
          ) : (
            <Button size="sm" onClick={submit} disabled={busy || hasOpen}>
              {hasOpen ? "Clock out first" : "Submit week"}
            </Button>
          )}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {week.entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="text-slate-600">
              {fmtDate(e.clockIn)} · {e.project || "—"}
            </span>
            <span className="text-slate-500">
              {fmtTime(e.clockIn)} –{" "}
              {e.clockOut ? fmtTime(e.clockOut) : <em className="text-emerald-600">open</em>}
              {e.clockOut && (
                <span className="ml-2 font-medium text-slate-700">
                  {hoursBetween(e.clockIn, e.clockOut).toFixed(1)}h
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Admin panel: approve submitted (not-yet-approved) weeks per user.
function AdminApprovalPanel() {
  const { users, timeEntries, update } = useData();

  const pending = useMemo(() => {
    const groups = new Map<
      string,
      { userId: string; userName: string; weekStart: Date; entries: TimeEntry[] }
    >();
    for (const e of timeEntries) {
      if (!e.submittedAt || e.approvedAt) continue;
      const wk = weekKey(new Date(e.clockIn));
      const key = `${e.userId}:${wk}`;
      if (!groups.has(key)) {
        const u = users.find((x) => x.id === e.userId);
        groups.set(key, {
          userId: e.userId,
          userName: u?.name || "Employee",
          weekStart: weekStart(new Date(e.clockIn)),
          entries: [],
        });
      }
      groups.get(key)!.entries.push(e);
    }
    return [...groups.values()];
  }, [timeEntries, users]);

  async function approve(userId: string, weekOf: Date, entries: TimeEntry[]) {
    const res = await fetch("/api/timesheets/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, weekOf: weekOf.toISOString() }),
    });
    if (res.ok) {
      const now = new Date().toISOString();
      entries.forEach((e) => update("timeEntries", e.id, { approvedAt: now }));
    }
  }

  return (
    <div className="mt-6">
      <Card title="Timesheets awaiting approval">
        {pending.length === 0 ? (
          <EmptyState title="Nothing to approve" description="All submitted weeks are approved." />
        ) : (
          <div className="space-y-2">
            {pending.map((g) => {
              const hours = g.entries
                .filter((e) => e.clockOut)
                .reduce((s, e) => s + hoursBetween(e.clockIn, e.clockOut!), 0);
              return (
                <div
                  key={`${g.userId}:${g.weekStart.toISOString()}`}
                  className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2.5"
                >
                  <div className="text-sm">
                    <span className="font-medium text-slate-800">{g.userName}</span>
                    <span className="text-slate-500">
                      {" "}
                      · week of {fmtDate(g.weekStart)} · {hours.toFixed(1)}h
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => approve(g.userId, g.weekStart, g.entries)}
                  >
                    Approve
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
