// The only place cache keys and pub/sub channels are spelled out.
// Services import from here so an invalidation can never miss a key because of a typo.

export const cacheKeys = {
  dashboard: (companyId: string) => `dashboard:${companyId}`,
  projectSummary: (projectId: string) => `project:${projectId}:summary`,
  company: (companyId: string) => `company:${companyId}`,
  member: (companyId: string, userId: string) => `member:${companyId}:${userId}`,
  /** AI standup summary. One per scope and period: everyone allowed to read it sees the same facts. */
  aiSummary: (scope: "project" | "team" | "company", scopeId: string, period: "day" | "week") => `ai:summary:${scope}:${scopeId}:${period}`,
} as const;

export const cacheTtlSeconds = {
  dashboard: 60,
  projectSummary: 120,
  company: 600,
  member: 60,
  /** Deliberately not invalidated on every task change: each regeneration costs tokens. */
  aiSummaryDay: 30 * 60,
  aiSummaryWeek: 6 * 60 * 60,
} as const;

/** Counters for AI usage limits. Bucketed by hour / UTC day so they expire on their own. */
export const limitKeys = {
  aiUserHour: (userId: string, hour: string) => `ai:rate:${userId}:${hour}`,
  aiCompanyTokensDay: (companyId: string, day: string) => `ai:tokens:${companyId}:${day}`,
} as const;

export const channels = {
  project: (projectId: string) => `project:${projectId}`,
  /** Pattern the realtime server subscribes to. */
  allProjects: "project:*",
} as const;
