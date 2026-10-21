import type { CompanyContext } from "@/lib/auth/get-company-context";
import { visibleProjectWhere, visibleTaskWhere, visibleTeamWhere } from "@/lib/authorization/visibility";
import { prisma } from "@/lib/db/prisma";

export type SearchResults = {
  query: string;
  projects: { id: string; name: string; key: string; status: string; team: string }[];
  tasks: { id: string; key: string; title: string; status: string; project: string; assignee: string | null }[];
  teams: { id: string; name: string; description: string | null }[];
};

const LIMIT = 8;

/**
 * Search never widens access: each branch ANDs the same visibility predicate the list
 * endpoints use with the text match. A task key like "PAY-14" is matched exactly.
 */
export async function search(ctx: CompanyContext, q: string): Promise<SearchResults> {
  const term = q.trim();
  const keyMatch = term.match(/^([A-Za-z][A-Za-z0-9]{1,5})-(\d{1,6})$/);

  const [projects, tasks, teams] = await Promise.all([
    prisma.project.findMany({
      where: { AND: [visibleProjectWhere(ctx), { OR: [{ name: { contains: term, mode: "insensitive" } }, { key: { equals: term.toUpperCase() } }] }] },
      take: LIMIT,
      orderBy: { name: "asc" },
      select: { id: true, name: true, key: true, status: true, team: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: {
        AND: [
          visibleTaskWhere(ctx),
          keyMatch
            ? { project: { key: keyMatch[1].toUpperCase() }, number: Number(keyMatch[2]) }
            : { title: { contains: term, mode: "insensitive" } },
        ],
      },
      take: LIMIT,
      orderBy: [{ updatedAt: "desc" }],
      select: { id: true, number: true, title: true, status: true, project: { select: { key: true, name: true } }, assignee: { select: { name: true } } },
    }),
    prisma.team.findMany({
      where: { AND: [visibleTeamWhere(ctx), { name: { contains: term, mode: "insensitive" } }] },
      take: LIMIT,
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true },
    }),
  ]);

  return {
    query: term,
    projects: projects.map(p => ({ id: p.id, name: p.name, key: p.key, status: p.status, team: p.team.name })),
    tasks: tasks.map(t => ({
      id: t.id,
      key: `${t.project.key}-${t.number}`,
      title: t.title,
      status: t.status,
      project: t.project.name,
      assignee: t.assignee?.name ?? null,
    })),
    teams,
  };
}
