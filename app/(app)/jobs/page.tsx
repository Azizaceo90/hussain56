"use client";

import { useCallback, useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  StatCard,
  money,
} from "@/components/ui";
import { fmtDate } from "@/lib/dates";

type Job = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  description: string | null;
  url: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  category: string | null;
  contractType: string | null;
  remote: boolean | null;
  postedAt: string | null;
};

export default function JobsPage() {
  const { session } = useData();
  const isAdmin = session.user.role === "admin";

  const [q, setQ] = useState("medical coding remote");
  const [remoteOnly, setRemoteOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    items: Job[];
    total: number;
    pages: number;
    configured: boolean;
  }>({ items: [], total: 0, pages: 0, configured: true });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { q?: string; page?: number; remote?: boolean }) => {
      setLoading(true);
      const params = new URLSearchParams({
        q: opts?.q ?? q,
        page: String(opts?.page ?? page),
        remote: (opts?.remote ?? remoteOnly) ? "1" : "0",
      });
      const res = await fetch(`/api/jobs?${params.toString()}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
      setLoading(false);
    },
    [q, page, remoteOnly]
  );

  useEffect(() => {
    load({ page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function search() {
    setPage(1);
    load({ q, page: 1, remote: remoteOnly });
  }

  async function sync() {
    setSyncing(true);
    setSyncMsg(null);
    const res = await fetch("/api/jobs/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q || "medical coding remote", target: 1000 }),
    });
    const result = await res.json().catch(() => ({}));
    setSyncing(false);
    if (!res.ok) {
      setSyncMsg(result.error || "Sync failed");
      return;
    }
    setSyncMsg(
      `Synced ${result.fetched} roles (${result.created} new) for “${result.query}”.`
    );
    setPage(1);
    load({ page: 1 });
  }

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle="Remote medical-coding roles, refreshed daily from Adzuna"
        actions={
          isAdmin && (
            <Button onClick={sync} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync 1000 roles"}
            </Button>
          )
        }
      />

      {!data.configured && (
        <Card className="mb-6">
          <div className="text-sm text-slate-600">
            <strong>Adzuna isn&apos;t configured yet.</strong> Add{" "}
            <code className="text-xs bg-slate-100 px-1 rounded">ADZUNA_APP_ID</code> and{" "}
            <code className="text-xs bg-slate-100 px-1 rounded">ADZUNA_APP_KEY</code> in your
            Vercel environment variables (free keys at{" "}
            <a
              href="https://developer.adzuna.com"
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 underline"
            >
              developer.adzuna.com
            </a>
            ), then redeploy and click <em>Sync</em>.
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Roles found" value={data.total} tone="blue" />
        <StatCard label="Page" value={`${data.pages ? page : 0} / ${data.pages}`} />
        <StatCard label="Filter" value={remoteOnly ? "Remote only" : "All"} tone="green" />
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Input
              label="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="medical coding remote"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 pb-2">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => {
                setRemoteOnly(e.target.checked);
                setPage(1);
                load({ page: 1, remote: e.target.checked });
              }}
            />
            Remote only
          </label>
          <Button onClick={search} disabled={loading}>
            Search
          </Button>
        </div>
        {syncMsg && <p className="text-sm text-slate-500 mt-3">{syncMsg}</p>}
      </Card>

      {loading ? (
        <Card>
          <p className="text-sm text-slate-400 text-center py-8">Loading roles…</p>
        </Card>
      ) : data.items.length === 0 ? (
        <Card>
          <EmptyState
            title="No roles yet"
            description={
              isAdmin
                ? "Click “Sync 1000 roles” to pull the latest remote medical-coding jobs from Adzuna."
                : "Check back soon — an admin will sync the latest roles."
            }
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {data.items.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}

      {data.pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹ Prev
          </Button>
          <span className="text-sm text-slate-500">
            Page {page} of {data.pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next ›
          </Button>
        </div>
      )}
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const salary =
    job.salaryMin || job.salaryMax
      ? `${job.salaryMin ? money(job.salaryMin) : "?"} – ${
          job.salaryMax ? money(job.salaryMax) : "?"
        }`
      : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-800 leading-snug">{job.title}</h3>
        {job.remote && <Badge tone="green">Remote</Badge>}
      </div>
      <div className="text-sm text-slate-500 mt-1">
        {job.company || "Company undisclosed"}
        {job.location ? ` · ${job.location}` : ""}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {job.category && <Badge>{job.category}</Badge>}
        {job.contractType && <Badge tone="violet">{job.contractType}</Badge>}
        {salary && <Badge tone="amber">{salary}</Badge>}
      </div>
      {job.description && (
        <p className="text-xs text-slate-500 mt-3 line-clamp-3">{job.description}</p>
      )}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-400">
          {job.postedAt ? `Posted ${fmtDate(job.postedAt)}` : ""}
        </span>
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            View & apply →
          </a>
        )}
      </div>
    </div>
  );
}
