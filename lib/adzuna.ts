import { prisma } from "./prisma";

// Adzuna job-search integration. Free credentials at https://developer.adzuna.com
// Set ADZUNA_APP_ID and ADZUNA_APP_KEY in the environment. When unset, the
// feature degrades gracefully (the page shows a "not configured" notice).

const BASE = "https://api.adzuna.com/v1/api/jobs";

export const DEFAULT_QUERY = "medical coding remote";
export const DEFAULT_COUNTRY = "us";

// A campaign of related searches run together to maximize coverage of remote
// medical-coding roles (Adzuna ranks by relevance per query, so variants pull
// different listings). Results are merged and deduped by Adzuna id.
export const DEFAULT_QUERIES = [
  "medical coding remote",
  "medical coder remote",
  "remote medical coding",
  "medical coder",
  "medical coding",
  "medical billing and coding",
  "certified professional coder",
  "risk adjustment coder",
];

export function adzunaConfigured(): boolean {
  return !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
}

type AdzunaResult = {
  id: string;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  contract_time?: string;
  contract_type?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  category?: { label?: string };
};

async function fetchPage(opts: {
  country: string;
  query: string;
  page: number;
  resultsPerPage: number;
  maxDaysOld?: number;
  sortByDate?: boolean;
}): Promise<AdzunaResult[]> {
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID!,
    app_key: process.env.ADZUNA_APP_KEY!,
    results_per_page: String(opts.resultsPerPage),
    what: opts.query,
    "content-type": "application/json",
  });
  if (opts.maxDaysOld) params.set("max_days_old", String(opts.maxDaysOld));
  if (opts.sortByDate) params.set("sort_by", "date");

  const url = `${BASE}/${opts.country}/search/${opts.page}?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Adzuna ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

function looksRemote(r: AdzunaResult): boolean {
  const hay = `${r.title ?? ""} ${r.description ?? ""} ${r.location?.display_name ?? ""}`.toLowerCase();
  return /\bremote\b|work from home|telecommute|wfh/.test(hay);
}

// Pull up to `target` listings across paged requests and upsert them by
// Adzuna id. Returns how many were fetched and how many were new.
export async function syncJobs(opts?: {
  query?: string;
  queries?: string[];
  country?: string;
  target?: number;
  maxDaysOld?: number;
}): Promise<{ configured: boolean; fetched: number; created: number; query: string }> {
  // A single typed query runs precisely; otherwise run the broad campaign.
  const queries =
    opts?.queries && opts.queries.length
      ? opts.queries
      : opts?.query?.trim()
        ? [opts.query.trim()]
        : DEFAULT_QUERIES;
  const label = opts?.query?.trim() || "remote medical coding (campaign)";

  if (!adzunaConfigured())
    return { configured: false, fetched: 0, created: 0, query: label };

  const country = opts?.country || DEFAULT_COUNTRY;
  const target = Math.min(opts?.target ?? 1000, 1000);
  const resultsPerPage = 50; // Adzuna max
  const maxPagesPerQuery = 10; // up to 500 per query before moving on
  const BATCH = 4;

  // Dedupe across all queries by Adzuna id.
  const unique = new Map<string, AdzunaResult>();

  outer: for (const query of queries) {
    for (let start = 1; start <= maxPagesPerQuery; start += BATCH) {
      const batch: Promise<AdzunaResult[]>[] = [];
      for (let p = start; p < start + BATCH && p <= maxPagesPerQuery; p++) {
        batch.push(
          fetchPage({
            country,
            query,
            page: p,
            resultsPerPage,
            maxDaysOld: opts?.maxDaysOld,
            sortByDate: true,
          }).catch(() => [] as AdzunaResult[])
        );
      }
      const pages = await Promise.all(batch);
      let emptyRun = true;
      for (const page of pages) {
        if (page.length > 0) emptyRun = false;
        for (const r of page) if (r.id && !unique.has(r.id)) unique.set(r.id, r);
      }
      if (unique.size >= target) break outer;
      if (emptyRun) break; // exhausted this query; move to the next
    }
  }

  // Figure out which ids are genuinely new (for an accurate "created" count).
  const ids = [...unique.keys()];
  const existing = await prisma.jobListing.findMany({
    where: { externalId: { in: ids } },
    select: { externalId: true },
  });
  const existingIds = new Set(existing.map((e) => e.externalId));
  let created = 0;

  for (const r of unique.values()) {
    const data = {
      source: "adzuna",
      title: r.title?.replace(/<\/?[^>]+>/g, "").trim() || "Untitled role",
      company: r.company?.display_name ?? null,
      location: r.location?.display_name ?? null,
      description: r.description?.replace(/<\/?[^>]+>/g, "").trim() ?? null,
      url: r.redirect_url ?? null,
      salaryMin: r.salary_min ?? null,
      salaryMax: r.salary_max ?? null,
      category: r.category?.label ?? null,
      contractType: r.contract_time || r.contract_type || null,
      remote: looksRemote(r),
      postedAt: r.created ? new Date(r.created) : null,
      query: label,
      fetchedAt: new Date(),
    };
    await prisma.jobListing.upsert({
      where: { externalId: r.id },
      create: { externalId: r.id, ...data },
      update: data,
    });
    if (!existingIds.has(r.id)) created++;
  }

  return { configured: true, fetched: unique.size, created, query: label };
}
