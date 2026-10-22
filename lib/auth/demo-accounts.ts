// Shown on the sign-in page so reviewers can jump between roles. Mirrors db/seed.ts.
// Hide in production by setting NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=false.
import { color } from "@/lib/design-system";

export const DEMO_PASSWORD = "Password123!";

export type DemoAccount = { initials: string; name: string; email: string; role: string; company: string; color: string };

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { initials: "PN", name: "Priya Nair", email: "ceo@acme.test", role: "CEO", company: "Acme Technologies", color: color.avatar[0] },
  { initials: "RM", name: "Rahul Mehta", email: "cto@acme.test", role: "Tech Lead", company: "Acme Technologies", color: color.avatar[1] },
  { initials: "NK", name: "Neha Kapoor", email: "pm@acme.test", role: "Project Manager", company: "Acme Technologies", color: color.avatar[2] },
  { initials: "AR", name: "Arjun Rao", email: "lead@acme.test", role: "Team Lead", company: "Acme Technologies", color: color.avatar[3] },
  { initials: "AS", name: "Amit Singh", email: "dev1@acme.test", role: "Member", company: "Acme Technologies", color: color.avatar[4] },
  { initials: "SI", name: "Sara Iyer", email: "dev2@acme.test", role: "Member", company: "Acme Technologies", color: color.avatar[5] },
  { initials: "VD", name: "Vikram Das", email: "viewer@acme.test", role: "Viewer", company: "Acme Technologies", color: color.avatar[6] },
  { initials: "BG", name: "Bob Globex", email: "ceo@globex.test", role: "CEO", company: "Globex Corp", color: color.avatar[7] },
];

export const showDemoAccounts = () => process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== "false";
