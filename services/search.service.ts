import { Op, type WhereOptions } from "sequelize";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { visibleProjectWhere, visibleTaskWhere, visibleTeamWhere } from "@/lib/authorization/visibility";
import { Project, Task, Team, User } from "@/lib/db/models";

export type SearchResults = {
  query: string;
  projects: { id: string; name: string; key: string; status: string; team: string }[];
  tasks: { id: string; key: string; title: string; status: string; project: string; assignee: string | null }[];
  teams: { id: string; name: string; description: string | null }[];
};

const LIMIT = 8;

/** `%term%` for ILIKE, with the LIKE wildcards in the user's text escaped. */
const contains = (term: string) => `%${term.replace(/[\\%_]/g, c => `\\${c}`)}%`;

/**
 * Search never widens access: each branch ANDs the same visibility predicate the list
 * endpoints use with the text match. A task key like "PAY-14" is matched exactly.
 */
export async function search(ctx: CompanyContext, q: string): Promise<SearchResults> {
  const term = q.trim();
  const keyMatch = term.match(/^([A-Za-z][A-Za-z0-9]{1,5})-(\d{1,6})$/);

  const taskMatch: WhereOptions = keyMatch
    ? { number: Number(keyMatch[2]), "$project.key$": keyMatch[1].toUpperCase() }
    : { title: { [Op.iLike]: contains(term) } };

  const [projects, tasks, teams] = await Promise.all([
    Project.findAll({
      where: { [Op.and]: [visibleProjectWhere(ctx), { [Op.or]: [{ name: { [Op.iLike]: contains(term) } }, { key: term.toUpperCase() }] }] },
      attributes: ["id", "name", "key", "status"],
      include: [{ model: Team, as: "team", attributes: ["name"] }],
      order: [["name", "ASC"]],
      limit: LIMIT,
    }),
    Task.findAll({
      where: { [Op.and]: [visibleTaskWhere(ctx), taskMatch] },
      attributes: ["id", "number", "title", "status"],
      include: [
        { model: Project, as: "project", attributes: ["key", "name"] },
        { model: User, as: "assignee", attributes: ["name"] },
      ],
      order: [["updatedAt", "DESC"]],
      limit: LIMIT,
    }),
    Team.findAll({
      where: { [Op.and]: [visibleTeamWhere(ctx), { name: { [Op.iLike]: contains(term) } }] },
      attributes: ["id", "name", "description"],
      order: [["name", "ASC"]],
      limit: LIMIT,
    }),
  ]);

  return {
    query: term,
    projects: projects.map(p => ({ id: p.id, name: p.name, key: p.key, status: p.status, team: p.team!.name })),
    tasks: tasks.map(t => ({
      id: t.id,
      key: `${t.project!.key}-${t.number}`,
      title: t.title,
      status: t.status,
      project: t.project!.name,
      assignee: t.assignee?.name ?? null,
    })),
    teams: teams.map(t => ({ id: t.id, name: t.name, description: t.description })),
  };
}
