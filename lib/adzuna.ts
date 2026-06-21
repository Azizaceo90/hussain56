import { prisma } from "./prisma";

// Adzuna job-search integration. Free credentials at https://developer.adzuna.com
// Set ADZUNA_APP_ID and ADZUNA_APP_KEY in the environment. When unset, the
// feature degrades gracefully (the page shows a "not configured" notice).

const BASE = "https://api.adzuna.com/v1/api/jobs";

export const DEFAULT_QUERY = "medical coding remote";
export const DEFAULT_COUNTRY = "us";

// A campaign of related searches run together to maximize coverage of remote
// medical-coding roles. `whatOr` uses Adzuna's "any of these words" mode to
// widen results well beyond strict phrase matching. Results are merged and
// deduped by Adzuna id across all searches.
export type JobQuery = { what?: string; whatOr?: string; label: string };

export const DEFAULT_QUERIES: JobQuery[] = [
  { what: "medical coder", label: "medical coder" },
  { what: "medical coding", label: "medical coding" },
  { what: "medical biller", label: "medical biller" },
  { what: "coding specialist", label: "coding specialist" },
  { what: "health information technician", label: "health information technician" },
  { what: "inpatient coder", label: "inpatient coder" },
  { what: "outpatient coder", label: "outpatient coder" },
  { what: "risk adjustment coder", label: "risk adjustment coder" },
  // Broad nets: medical jobs mentioning ANY of these coding-related words.
  { what: "medical", whatOr: "coder coding biller billing", label: "medical + coding/billing" },
  { whatOr: "coder coding", label: "any coder/coding" },
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
  what?: string;
  whatOr?: string;
  page: number;
  resultsPerPage: number;
  maxDaysOld?: number;
  sortByDate?: boolean;
}): Promise<AdzunaResult[]> {
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID!,
    app_key: process.env.ADZUNA_APP_KEY!,
    results_per_page: String(opts.resultsPerPage),
    "content-type": "application/json",
  });
  if (opts.what) params.set("what", opts.what);
  if (opts.whatOr) params.set("what_or", opts.whatOr);
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
  queries?: JobQuery[];
  country?: string;
  target?: number;
  maxDaysOld?: number;
}): Promise<{
  configured: boolean;
  fetched: number;
  created: number;
  query: string;
  breakdown: { label: string; count: number }[];
}> {
  // A single typed query runs precisely; otherwise run the broad campaign.
  const queries: JobQuery[] =
    opts?.queries && opts.queries.length
      ? opts.queries
      : opts?.query?.trim()
        ? [{ what: opts.query.trim(), label: opts.query.trim() }]
        : DEFAULT_QUERIES;
  const label = opts?.query?.trim() || "remote medical coding (campaign)";

  if (!adzunaConfigured())
    return { configured: false, fetched: 0, created: 0, query: label, breakdown: [] };

  const country = opts?.country || DEFAULT_COUNTRY;
  const target = Math.min(opts?.target ?? 1000, 1000);
  const resultsPerPage = 50; // Adzuna max
  const maxPagesPerQuery = 20; // up to 1000 per query before moving on
  const BATCH = 4;

  // Dedupe across all queries by Adzuna id.
  const unique = new Map<string, AdzunaResult>();
  const breakdown: { label: string; count: number }[] = [];

  outer: for (const query of queries) {
    const before = unique.size;
    for (let start = 1; start <= maxPagesPerQuery; start += BATCH) {
      const batch: Promise<AdzunaResult[]>[] = [];
      for (let p = start; p < start + BATCH && p <= maxPagesPerQuery; p++) {
        batch.push(
          fetchPage({
            country,
            what: query.what,
            whatOr: query.whatOr,
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
      if (emptyRun) break; // exhausted this query; move to the next
      if (unique.size >= target) {
        breakdown.push({ label: query.label, count: unique.size - before });
        break outer;
      }
    }
    breakdown.push({ label: query.label, count: unique.size - before });
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

  return { configured: true, fetched: unique.size, created, query: label, breakdown };
}
