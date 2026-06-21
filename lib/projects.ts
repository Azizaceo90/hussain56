// Per-title default project lists for the Time Tracker. A user's own
// `projects` field (comma-separated) overrides the title default.

export const PROJECTS_BY_TITLE: Record<string, string[]> = {
  "Medical Coder": ["St Bernards", "UHC"],
  "Medical Biller": ["St Bernards", "UHC", "Aetna"],
  "Front Desk": ["Reception", "Scheduling"],
  Developer: ["Platform", "Internal Tools"],
};

export const DEFAULT_PROJECTS = ["General"];

export function projectsForUser(user: {
  title?: string | null;
  projects?: string | null;
}): string[] {
  // Per-employee override wins.
  if (user.projects && user.projects.trim()) {
    return user.projects
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  }
  if (user.title && PROJECTS_BY_TITLE[user.title]) {
    return PROJECTS_BY_TITLE[user.title];
  }
  return DEFAULT_PROJECTS;
}
