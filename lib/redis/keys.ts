// The only place cache keys and pub/sub channels are spelled out.
// Services import from here so an invalidation can never miss a key because of a typo.

export const cacheKeys = {
  dashboard: (companyId: string) => `dashboard:${companyId}`,
  projectSummary: (projectId: string) => `project:${projectId}:summary`,
  company: (companyId: string) => `company:${companyId}`,
  member: (companyId: string, userId: string) => `member:${companyId}:${userId}`,
} as const;

export const cacheTtlSeconds = {
  dashboard: 60,
  projectSummary: 120,
  company: 600,
  member: 60,
} as const;

export const channels = {
  project: (projectId: string) => `project:${projectId}`,
  /** Pattern the realtime server subscribes to. */
  allProjects: "project:*",
} as const;
