// Demo data. This is the contract the demo walkthrough relies on:
// changing a name, role or membership here means updating the demo script too.
//
// Run: npm run db:seed   (tsx db/seed.ts)
// Idempotent: wipes every table and recreates the same data.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { CompanyRole, ProjectStatus, TaskPriority, TaskStatus } from "@/lib/db/enums";
import { Activity, Comment, Company, CompanyMember, Project, ProjectMember, Task, Team, TeamMember, User, sequelize } from "@/lib/db/models";

export const DEMO_PASSWORD = "Password123!";

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000);
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

type SeedTask = {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null; // user key
  due: number | null; // days from now
  description?: string;
};

export async function seed() {
  await sequelize.query(
    `TRUNCATE "Activity", "Comment", "Task", "ProjectMember", "Project", "TeamMember", "Team", "CompanyMember", "Company", "User" CASCADE`,
  );

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ---------- Companies ----------
  const acme = await Company.create({ name: "Acme Technologies", slug: "acme" });
  const globex = await Company.create({ name: "Globex Corp", slug: "globex" });

  // ---------- Users ----------
  const userDefs = {
    priya: { name: "Priya Nair", email: "ceo@acme.test" },
    rahul: { name: "Rahul Mehta", email: "cto@acme.test" },
    neha: { name: "Neha Kapoor", email: "pm@acme.test" },
    arjun: { name: "Arjun Rao", email: "lead@acme.test" },
    amit: { name: "Amit Singh", email: "dev1@acme.test" },
    sara: { name: "Sara Iyer", email: "dev2@acme.test" },
    vikram: { name: "Vikram Das", email: "viewer@acme.test" },
    bob: { name: "Bob Globex", email: "ceo@globex.test" },
  } as const;
  type UserKey = keyof typeof userDefs;

  const users = {} as Record<UserKey, { id: string }>;
  for (const [key, def] of Object.entries(userDefs) as [UserKey, { name: string; email: string }][]) {
    users[key] = await User.create({ ...def, passwordHash });
  }

  // ---------- Company memberships ----------
  const acmeRoles: [UserKey, CompanyRole][] = [
    ["priya", CompanyRole.CEO],
    ["rahul", CompanyRole.TECH_LEAD],
    ["neha", CompanyRole.PROJECT_MANAGER],
    ["arjun", CompanyRole.TEAM_LEAD],
    ["amit", CompanyRole.MEMBER],
    ["sara", CompanyRole.MEMBER],
    ["vikram", CompanyRole.VIEWER],
  ];
  await CompanyMember.bulkCreate([
    ...acmeRoles.map(([key, role]) => ({ companyId: acme.id, userId: users[key].id, role })),
    { companyId: globex.id, userId: users.bob.id, role: CompanyRole.CEO },
  ]);

  // ---------- Teams ----------
  const engineering = await Team.create({ companyId: acme.id, name: "Engineering", description: "Platform, payments and core services" });
  const product = await Team.create({ companyId: acme.id, name: "Product", description: "Roadmap, discovery and the mobile app" });
  await Team.create({ companyId: acme.id, name: "Design", description: "Brand and product design" });

  await TeamMember.bulkCreate([
    { teamId: engineering.id, userId: users.arjun.id },
    { teamId: engineering.id, userId: users.amit.id },
    { teamId: engineering.id, userId: users.sara.id },
    { teamId: product.id, userId: users.rahul.id },
  ]);

  // ---------- Projects ----------
  const payments = await Project.create({
    companyId: acme.id,
    teamId: engineering.id,
    name: "Payment Service",
    key: "PAY",
    description: "Card payments, retries, webhooks and refunds for checkout.",
    status: ProjectStatus.ACTIVE,
    projectManagerId: users.neha.id,
  });
  const userPlatform = await Project.create({
    companyId: acme.id,
    teamId: engineering.id,
    name: "User Platform",
    key: "UP",
    description: "Accounts, profiles, sessions and search.",
    status: ProjectStatus.ACTIVE,
    projectManagerId: users.rahul.id,
  });
  const mobile = await Project.create({
    companyId: acme.id,
    teamId: product.id,
    name: "Mobile App",
    key: "MOB",
    description: "Native companion app. Kick-off pending a project manager.",
    status: ProjectStatus.PLANNED,
  });

  await ProjectMember.bulkCreate([
    { projectId: payments.id, userId: users.neha.id },
    { projectId: payments.id, userId: users.amit.id },
    { projectId: payments.id, userId: users.arjun.id },
    { projectId: payments.id, userId: users.vikram.id },
    { projectId: userPlatform.id, userId: users.rahul.id },
    { projectId: userPlatform.id, userId: users.sara.id },
    { projectId: userPlatform.id, userId: users.arjun.id },
  ]);

  // ---------- Tasks ----------
  const paymentTasks: SeedTask[] = [
    { title: "Webhook signature verification", status: TaskStatus.TODO, priority: TaskPriority.HIGH, assignee: null, due: 15 },
    { title: "Idempotency keys for POST /payments", status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, assignee: "arjun", due: 17 },
    { title: "Refund API", status: TaskStatus.TODO, priority: TaskPriority.LOW, assignee: null, due: 21 },
    {
      title: "Add retry mechanism",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.URGENT,
      assignee: "amit",
      due: 3,
      description:
        "Retry failed provider calls with exponential backoff (base 500 ms, max 5 attempts, jitter). Only retry on network errors and 5xx. Every retry must reuse the original idempotency key so a duplicate charge is impossible.",
    },
    { title: "Payment status polling", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM, assignee: "arjun", due: 6 },
    { title: "Webhook handler", status: TaskStatus.IN_REVIEW, priority: TaskPriority.HIGH, assignee: "amit", due: 1 },
    { title: "Payment API", status: TaskStatus.DONE, priority: TaskPriority.HIGH, assignee: "amit", due: -6 },
    { title: "Stripe sandbox setup", status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, assignee: "neha", due: -11 },
    { title: "Schema: payments table", status: TaskStatus.DONE, priority: TaskPriority.LOW, assignee: "arjun", due: -13 },
    { title: "Provider abstraction", status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, assignee: "amit", due: -18 },
    { title: "Currency handling", status: TaskStatus.DONE, priority: TaskPriority.LOW, assignee: "arjun", due: -20 },
  ];
  const userPlatformTasks: SeedTask[] = [
    { title: "Create user profile API", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, assignee: "sara", due: 4 },
    { title: "Implement search", status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, assignee: "sara", due: 12 },
    { title: "Profile avatar upload", status: TaskStatus.TODO, priority: TaskPriority.LOW, assignee: null, due: 20 },
    { title: "Email verification flow", status: TaskStatus.IN_REVIEW, priority: TaskPriority.MEDIUM, assignee: "arjun", due: 2 },
    { title: "Rate limiting on auth endpoints", status: TaskStatus.TODO, priority: TaskPriority.HIGH, assignee: null, due: 9 },
    { title: "Session revocation", status: TaskStatus.DONE, priority: TaskPriority.HIGH, assignee: "sara", due: -4 },
    { title: "Schema: users and sessions", status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, assignee: "arjun", due: -15 },
  ];

  const createTasks = async (projectId: string, companyId: string, createdBy: string, tasks: SeedTask[]) => {
    const created: { id: string; title: string }[] = [];
    // Seed order is oldest-first so the board reads naturally: done tasks got the low numbers.
    const ordered = [...tasks].reverse();
    let number = 0;
    for (const t of ordered) {
      number += 1;
      const row = await Task.create({
        companyId,
        projectId,
        number,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        assigneeId: t.assignee ? users[t.assignee as UserKey].id : null,
        createdById: createdBy,
        dueDate: t.due === null ? null : daysFromNow(t.due),
      });
      created.push({ id: row.id, title: row.title });
    }
    await Project.update({ taskCounter: number }, { where: { id: projectId } });
    return created;
  };

  const payRows = await createTasks(payments.id, acme.id, users.neha.id, paymentTasks);
  const upRows = await createTasks(userPlatform.id, acme.id, users.rahul.id, userPlatformTasks);

  const retryTask = payRows.find(t => t.title === "Add retry mechanism")!;
  const webhookTask = payRows.find(t => t.title === "Webhook handler")!;
  const profileApiTask = upRows.find(t => t.title === "Create user profile API")!;

  // ---------- Comments ----------
  await Comment.bulkCreate([
    {
      companyId: acme.id,
      taskId: retryTask.id,
      userId: users.neha.id,
      content: "Let's cap total retry time at 30 s so the checkout UI can show a clean failure instead of hanging.",
      createdAt: hoursAgo(20),
    },
    {
      companyId: acme.id,
      taskId: retryTask.id,
      userId: users.amit.id,
      content: "Agreed. Backoff schedule is 0.5, 1, 2, 4, 8 s, which lands at ~15 s worst case before the cap.",
      createdAt: hoursAgo(2),
    },
  ]);

  // ---------- Activity ----------
  await Activity.bulkCreate([
    { companyId: acme.id, userId: users.priya.id, entityType: "PROJECT", entityId: mobile.id, projectId: mobile.id, teamId: product.id, action: "PROJECT_CREATED", metadata: { name: "Mobile App" }, createdAt: hoursAgo(3) },
    { companyId: acme.id, userId: users.priya.id, entityType: "PROJECT", entityId: userPlatform.id, projectId: userPlatform.id, teamId: engineering.id, action: "PROJECT_MANAGER_CHANGED", metadata: { name: "User Platform", to: users.rahul.id, toName: "Rahul Mehta" }, createdAt: hoursAgo(30) },
    { companyId: acme.id, userId: users.arjun.id, entityType: "TEAM", entityId: engineering.id, teamId: engineering.id, action: "TEAM_MEMBER_ADDED", metadata: { team: "Engineering", userId: users.sara.id, userName: "Sara Iyer" }, createdAt: hoursAgo(1) },
    { companyId: acme.id, userId: users.neha.id, entityType: "TASK", entityId: retryTask.id, projectId: payments.id, teamId: engineering.id, action: "TASK_ASSIGNED", metadata: { title: "Add retry mechanism", key: "PAY-8", to: users.amit.id, toName: "Amit Singh" }, createdAt: hoursAgo(0.45) },
    { companyId: acme.id, userId: users.amit.id, entityType: "TASK", entityId: retryTask.id, projectId: payments.id, teamId: engineering.id, action: "TASK_STATUS_CHANGED", metadata: { title: "Add retry mechanism", key: "PAY-8", from: "TODO", to: "IN_PROGRESS" }, createdAt: hoursAgo(2) },
    { companyId: acme.id, userId: users.amit.id, entityType: "TASK", entityId: webhookTask.id, projectId: payments.id, teamId: engineering.id, action: "TASK_STATUS_CHANGED", metadata: { title: "Webhook handler", key: "PAY-6", from: "IN_PROGRESS", to: "IN_REVIEW" }, createdAt: hoursAgo(0.07) },
    { companyId: acme.id, userId: users.sara.id, entityType: "TASK", entityId: profileApiTask.id, projectId: userPlatform.id, teamId: engineering.id, action: "COMMENT_ADDED", metadata: { title: "Create user profile API", key: "UP-7" }, createdAt: hoursAgo(5) },
  ]);

  // ---------- Globex (second tenant, for isolation demos) ----------
  const globexTeam = await Team.create({ companyId: globex.id, name: "Platform", description: "Globex core platform" });
  await TeamMember.create({ teamId: globexTeam.id, userId: users.bob.id });
  const globexProject = await Project.create({
    companyId: globex.id,
    teamId: globexTeam.id,
    name: "Data Warehouse",
    key: "DW",
    description: "Globex internal reporting warehouse.",
    status: ProjectStatus.ACTIVE,
    projectManagerId: users.bob.id,
  });
  await createTasks(globexProject.id, globex.id, users.bob.id, [
    { title: "Nightly ETL job", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, assignee: "bob", due: 5 },
    { title: "Finance dashboard", status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, assignee: null, due: 14 },
    { title: "Warehouse schema", status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, assignee: "bob", due: -9 },
  ]);

  return {
    companies: { acme: acme.id, globex: globex.id },
    users: Object.fromEntries(Object.entries(users).map(([k, v]) => [k, v.id])) as Record<UserKey, string>,
    projects: { payments: payments.id, userPlatform: userPlatform.id, mobile: mobile.id, globex: globexProject.id },
  };
}

// Entry point for `npm run db:seed` (tsx db/seed.ts).
if (process.argv[1]?.replace(/\\/g, "/").endsWith("db/seed.ts")) {
  seed()
    .then(async ids => {
      const [companies, users, teams, projects, tasks] = await Promise.all([Company.count(), User.count(), Team.count(), Project.count(), Task.count()]);
      console.log(`Seeded ${companies} companies, ${users} users, ${teams} teams, ${projects} projects, ${tasks} tasks.`);
      console.log(`Every account uses the password ${DEMO_PASSWORD}`);
      console.log(`Acme: ${ids.companies.acme}  Globex: ${ids.companies.globex}`);
    })
    .catch(err => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}
