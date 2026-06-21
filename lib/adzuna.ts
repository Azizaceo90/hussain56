import { prisma } from "./prisma";

// Adzuna job-search integration. Free credentials at https://developer.adzuna.com
// Set ADZUNA_APP_ID and ADZUNA_APP_KEY in the environment. When unset, the
// feature degrades gracefully (the page shows a "not configured" notice).

const BASE = "https://api.adzuna.com/v1/api/jobs";

export const DEFAULT_QUERY = "medical coding remote";
export const DEFAULT_COUNTRY = "us";

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
}): Promise<AdzunaResult[]> {
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID!,
    app_key: process.env.ADZUNA_APP_KEY!,
    results_per_page: String(opts.resultsPerPage),
    what: opts.query,
    "content-type": "application/json",
  });
  if (opts.maxDaysOld) params.set("max_days_old", String(opts.maxDaysOld));

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
  country?: string;
  target?: number;
  maxDaysOld?: number;
}): Promise<{ configured: boolean; fetched: number; created: number; query: string }> {
  const query = opts?.query?.trim() || DEFAULT_QUERY;
  if (!adzunaConfigured())
    return { configured: false, fetched: 0, created: 0, query };

  const country = opts?.country || DEFAULT_COUNTRY;
  const target = Math.min(opts?.target ?? 1000, 1000);
  const resultsPerPage = 50; // Adzuna max
  const totalPages = Math.ceil(target / resultsPerPage);

  // Fetch pages in small parallel batches to stay within serverless time.
  const all: AdzunaResult[] = [];
  const BATCH = 5;
  for (let start = 1; start <= totalPages; start += BATCH) {
    const batch = [];
    for (let p = start; p < start + BATCH && p <= totalPages; p++) {
      batch.push(
        fetchPage({ country, query, page: p, resultsPerPage, maxDaysOld: opts?.maxDaysOld }).catch(
          () => [] as AdzunaResult[]
        )
      );
    }
    const pages = await Promise.all(batch);
    let emptyRun = true;
    for (const page of pages) {
      if (page.length > 0) emptyRun = false;
      all.push(...page);
    }
    // Stop early if a whole batch came back empty (no more results).
    if (emptyRun) break;
  }

  // Dedupe by id.
  const unique = new Map<string, AdzunaResult>();
  for (const r of all) {
    if (r.id && !unique.has(r.id)) unique.set(r.id, r);
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
      query,
      fetchedAt: new Date(),
    };
    await prisma.jobListing.upsert({
      where: { externalId: r.id },
      create: { externalId: r.id, ...data },
      update: data,
    });
    if (!existingIds.has(r.id)) created++;
  }

  return { configured: true, fetched: unique.size, created, query };
}
