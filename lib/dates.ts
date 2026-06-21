// Date/time helpers. On Vercel the server runs in UTC, so naive Date math can
// shift wall-clock times. Build explicit UTC values and attach an IANA zone.

export const US_ZONES: Record<string, string> = {
  eastern: "America/New_York",
  central: "America/Chicago",
  mountain: "America/Denver",
  pacific: "America/Los_Angeles",
};

export const DEFAULT_TZ = "America/New_York";

// Detect a US timezone mentioned in free text before falling back to default.
export function detectTimeZone(text?: string | null, fallback = DEFAULT_TZ): string {
  if (!text) return fallback;
  const t = text.toLowerCase();
  for (const [key, zone] of Object.entries(US_ZONES)) {
    if (t.includes(key)) return zone;
  }
  if (t.includes("est") || t.includes("edt")) return US_ZONES.eastern;
  if (t.includes("cst") || t.includes("cdt")) return US_ZONES.central;
  if (t.includes("mst") || t.includes("mdt")) return US_ZONES.mountain;
  if (t.includes("pst") || t.includes("pdt")) return US_ZONES.pacific;
  return fallback;
}

// Build a UTC instant from wall-clock parts (avoids server-offset shifting).
export function wallClockUTC(
  y: number,
  m: number, // 1-12
  d: number,
  hh = 0,
  mm = 0
): Date {
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
}

// Monday of the week containing `d` (returns a UTC-midnight Date).
export function weekStart(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff)
  );
  return monday;
}

// Sunday end (UTC) of the week containing `d`.
export function weekEnd(d: Date): Date {
  const start = weekStart(d);
  return new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate() + 6,
      23,
      59,
      59,
      999
    )
  );
}

// YYYY-MM-DD key for a week's Monday (used to group/approve weeks).
export function weekKey(d: Date): string {
  const s = weekStart(d);
  return s.toISOString().slice(0, 10);
}

export function fmtDate(d: Date | string, tz = DEFAULT_TZ): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function fmtTime(d: Date | string, tz = DEFAULT_TZ): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function hoursBetween(a: Date | string, b: Date | string): number {
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  return Math.max(0, (end - start) / (1000 * 60 * 60));
}
