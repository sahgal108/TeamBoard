// Database enums. Values match the Postgres enum types created by the migrations.
// Each is both a runtime object (CompanyRole.CEO) and a string-union type (CompanyRole).

export const CompanyRole = {
  CEO: "CEO",
  TECH_LEAD: "TECH_LEAD",
  PROJECT_MANAGER: "PROJECT_MANAGER",
  TEAM_LEAD: "TEAM_LEAD",
  MEMBER: "MEMBER",
  VIEWER: "VIEWER",
} as const;
export type CompanyRole = (typeof CompanyRole)[keyof typeof CompanyRole];

export const ProjectStatus = {
  PLANNED: "PLANNED",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const TaskStatus = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  IN_REVIEW: "IN_REVIEW",
  DONE: "DONE",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];
