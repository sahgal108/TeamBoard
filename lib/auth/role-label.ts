import type { CompanyRole } from "@/lib/db/enums";

const LABELS: Record<CompanyRole, string> = {
  CEO: "CEO · full access",
  TECH_LEAD: "Tech Lead · full access",
  PROJECT_MANAGER: "Project Manager",
  TEAM_LEAD: "Team Lead",
  MEMBER: "Member",
  VIEWER: "Viewer · read only",
};

export function roleLabel(role: CompanyRole): string {
  return LABELS[role];
}
