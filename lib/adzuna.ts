import { prisma } from "./prisma";

// Adzuna job-search integration. Free credentials at https://developer.adzuna.com
// Set ADZUNA_APP_ID and ADZUNA_APP_KEY in the environment. When unset, the
// feature degrades gracefully (the page shows a "not configured" notice).

const BASE = "https://api.adzuna.com/v1/api/jobs";

export const DEFAULT_QUERY = "medical coding remote";
export const DEFAULT_COUNTRY = "us";
// Indexes to pull from by default (US + Canada).
export const DEFAULT_COUNTRIES = ["us", "ca"];

// A campaign of related searches run together to maximize coverage of remote
// medical-coding roles. `whatOr` uses Adzuna's "any of these words" mode to
// widen results well beyond strict phrase matching. Results are merged and
// deduped by Adzuna id across all searches.
export type JobQuery = { what?: string; whatOr?: string; label: string };

// Kept intentionally medical-focused so results stay on-topic (no generic
// software "coding" roles). Every search anchors on medical/health terms.
export const DEFAULT_QUERIES: JobQuery[] = [
  { what: "medical coder", label: "medical coder" },
  { what: "medical coding", label: "medical coding" },
  { what: "medical coding specialist", label: "medical coding specialist" },
  { what: "medical biller", label: "medical biller" },
  { what: "medical billing coding", label: "medical billing & coding" },
  { what: "health information technician", label: "health information tech" },
  { what: "inpatient medical coder", label: "inpatient coder" },
  { what: "outpatient medical coder", label: "outpatient coder" },
  { what: "risk adjustment coder", label: "risk adjustment coder" },
  { what: "remote medical coder", label: "remote medical coder" },
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
  countries?: string[];
  target?: number;
  maxDaysOld?: number;
  reset?: boolean;
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

  // Each country is a separate Adzuna index, so querying several multiplies the
  // pool. Listings are tagged by country and deduped by `${country}:${id}`.
  const countries = opts?.country
    ? [opts.country]
    : opts?.countries && opts.countries.length
      ? opts.countries
      : DEFAULT_COUNTRIES;
  const target = Math.min(opts?.target ?? 1000, 1000);
  const resultsPerPage = 50; // Adzuna max
  const maxPagesPerQuery = 20; // page deep into each result set
  const BATCH = 4;

  // Dedupe across all countries+queries. Key includes country to avoid id
  // collisions between indexes; value carries the source country.
  const unique = new Map<string, { country: string; r: AdzunaResult }>();
  const breakdownMap = new Map<string, number>();

  outer: for (const country of countries) {
    for (const query of queries) {
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
              // Relevance ranking (not date) exposes the full result set so deep
              // pagination returns distinct roles instead of the same newest few.
              sortByDate: false,
            }).catch(() => [] as AdzunaResult[])
          );
        }
        const pages = await Promise.all(batch);
        let emptyRun = true;
        for (const page of pages) {
          if (page.length > 0) emptyRun = false;
          for (const r of page) {
            if (!r.id) continue;
            const key = `${country}:${r.id}`;
            if (!unique.has(key)) unique.set(key, { country, r });
          }
        }
        if (emptyRun) break;
        if (unique.size >= target) {
          breakdownMap.set(query.label, (breakdownMap.get(query.label) ?? 0) + unique.size - before);
          break outer;
        }
      }
      breakdownMap.set(query.label, (breakdownMap.get(query.label) ?? 0) + unique.size - before);
    }
  }

  const breakdown = [...breakdownMap.entries()].map(([label, count]) => ({ label, count }));

  // Optional clean rebuild: drop existing listings so stale/off-topic roles
  // from earlier syncs don't linger.
  if (opts?.reset) {
    await prisma.jobListing.deleteMany({});
  }

  // Figure out which ids are genuinely new (for an accurate "created" count).
  const ids = [...unique.keys()];
  const existing = await prisma.jobListing.findMany({
    where: { externalId: { in: ids } },
    select: { externalId: true },
  });
  const existingIds = new Set(existing.map((e) => e.externalId));
  let created = 0;

  for (const [externalId, { country, r }] of unique.entries()) {
    const loc = r.location?.display_name
      ? `${r.location.display_name}, ${country.toUpperCase()}`
      : country.toUpperCase();
    const data = {
      source: "adzuna",
      title: r.title?.replace(/<\/?[^>]+>/g, "").trim() || "Untitled role",
      company: r.company?.display_name ?? null,
      location: loc,
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
      where: { externalId },
      create: { externalId, ...data },
      update: data,
    });
    if (!existingIds.has(externalId)) created++;
  }

  return { configured: true, fetched: unique.size, created, query: label, breakdown };
}
