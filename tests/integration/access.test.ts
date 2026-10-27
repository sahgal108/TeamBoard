import { beforeAll, describe, expect, it } from "vitest";
import { Task } from "@/lib/db/models";
import { ForbiddenError, InvalidTransitionError, NotFoundError } from "@/lib/errors";
import { getProject, listProjects } from "@/services/project.service";
import { search } from "@/services/search.service";
import { changeTaskStatus, getTask, listTasks } from "@/services/task.service";
import { login, resetData, type SeedIds } from "./helpers";

let ids: SeedIds;
const taskId = async (title: string) => (await Task.findOne({ where: { title }, rejectOnEmpty: true })).id;

beforeAll(async () => {
  ids = await resetData();
});

describe("tenant isolation", () => {
  it("another company's project and task are 404, exactly like ones that do not exist", async () => {
    const globex = await login.globexCeo();
    await expect(getProject(globex, ids.projects.payments)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getTask(globex, await taskId("Add retry mechanism"))).rejects.toBeInstanceOf(NotFoundError);
    await expect(getProject(globex, "does-not-exist")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lists and search never include another company's rows", async () => {
    const globex = await login.globexCeo();
    const tasks = await listTasks(globex);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every(t => t.project.id === ids.projects.globex)).toBe(true);
    expect((await listProjects(globex)).map(p => p.id)).toEqual([ids.projects.globex]);

    const found = await search(globex, "Payment");
    expect(found.projects).toEqual([]);
    expect(found.tasks).toEqual([]);
  });
});

describe("visibility inside a company", () => {
  it("a project outside the caller's scope is 404, not 403", async () => {
    const pm = await login.pm();
    await expect(getProject(pm, ids.projects.userPlatform)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getProject(pm, ids.projects.mobile)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getProject(pm, ids.projects.payments)).resolves.toBeTruthy();
  });

  it("a viewer's task list holds only the projects they belong to", async () => {
    const tasks = await listTasks(await login.viewer());
    expect(new Set(tasks.map(t => t.project.key))).toEqual(new Set(["PAY"]));
  });
});

describe("changing a task", () => {
  it("a member may move a task assigned to them but not someone else's", async () => {
    const dev1 = await login.dev1();
    const moved = await changeTaskStatus(dev1, await taskId("Add retry mechanism"), "IN_REVIEW");
    expect(moved.status).toBe("IN_REVIEW");
    await expect(changeTaskStatus(dev1, await taskId("Payment status polling"), "IN_REVIEW")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("a viewer cannot move anything", async () => {
    await expect(changeTaskStatus(await login.viewer(), await taskId("Webhook handler"), "DONE")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("the state machine applies even to the CEO", async () => {
    await expect(changeTaskStatus(await login.ceo(), await taskId("Refund API"), "DONE")).rejects.toBeInstanceOf(InvalidTransitionError);
  });
});
