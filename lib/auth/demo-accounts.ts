// Shown on the sign-in page so reviewers can jump between roles. Mirrors prisma/seed.ts.
// Hide in production by setting NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=false.
export const DEMO_PASSWORD = "Password123!";

export type DemoAccount = { initials: string; name: string; email: string; role: string; company: string; color: string };

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { initials: "PN", name: "Priya Nair", email: "ceo@acme.test", role: "CEO", company: "Acme Technologies", color: "#0b7a5c" },
  { initials: "RM", name: "Rahul Mehta", email: "cto@acme.test", role: "Tech Lead", company: "Acme Technologies", color: "#1d4ed8" },
  { initials: "NK", name: "Neha Kapoor", email: "pm@acme.test", role: "Project Manager", company: "Acme Technologies", color: "#7c3aed" },
  { initials: "AR", name: "Arjun Rao", email: "lead@acme.test", role: "Team Lead", company: "Acme Technologies", color: "#b45309" },
  { initials: "AS", name: "Amit Singh", email: "dev1@acme.test", role: "Member", company: "Acme Technologies", color: "#0e7490" },
  { initials: "SI", name: "Sara Iyer", email: "dev2@acme.test", role: "Member", company: "Acme Technologies", color: "#be185d" },
  { initials: "VD", name: "Vikram Das", email: "viewer@acme.test", role: "Viewer", company: "Acme Technologies", color: "#4b5563" },
  { initials: "BG", name: "Bob Globex", email: "ceo@globex.test", role: "CEO", company: "Globex Corp", color: "#374151" },
];

export const showDemoAccounts = () => process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== "false";
