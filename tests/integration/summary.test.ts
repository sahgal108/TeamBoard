import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setProviderForTests } from "@/lib/ai/provider";
import { Task, Team } from "@/lib/db/models";
import { AiDisabledError, ForbiddenError, NotFoundError, RateLimitedError } from "@/lib/errors";
import { limitKeys } from "@/lib/redis/keys";
import { redis } from "@/lib/redis/redis";
import { getCompanySummary, getProjectSummary, getTeamSummary } from "@/services/summary.service";
import { addComment, changeTaskStatus } from "@/services/task.service";
import { fakeProvider, login, resetData, type SeedIds } from "./helpers";

let ids: SeedIds;
const task = (title: string) => Task.findOne({ where: { title }, rejectOnEmpty: true });
const engineeringId = async () => (await Team.findOne({ where: { name: "Engineering" }, rejectOnEmpty: true })).id;
const today = () => new Date().toISOString().slice(0, 10);
const thisHour = () => new Date().toISOString().slice(0, 13);

/** Every task key the model was shown, in any list. */
const keysIn = (prompt: string) => [...prompt.matchAll(/"key": "([A-Z]+-\d+)"/g)].map(m => m[1]);

/** A model that writes a note for every task it was shown. */
const echoModel = () =>
  fakeProvider(req => {
    const notes = keysIn(req.prompt).map(key => ({ key, note: `note for ${key}` }));
    return { headline: "A quiet week.", done: notes, inProgress: notes, blocked: notes };
  });

beforeEach(async () => {
  ids = await resetData();
});
afterEach(() => setProviderForTests(undefined));

describe("what goes into a summary", () => {
  it("only the project's own tasks reach the model and the result", async () => {
    const { calls } = echoModel();
    const { summary } = await getProjectSummary(await login.ceo(), ids.projects.payments, "week");

    expect(calls).toHaveLength(1);
    const shown = keysIn(calls[0].prompt);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every(k => k.startsWith("PAY-"))).toBe(true);
    const listed = [...summary.done, ...summary.inProgress, ...summary.blocked].map(i => i.key);
    expect(listed.every(k => k.startsWith("PAY-"))).toBe(true);
  });

  it("a task completed in the period appears under done, from the activity log", async () => {
    echoModel();
    const webhook = await task("Webhook handler");
    await changeTaskStatus(await login.pm(), webhook.id, "DONE");

    const { summary } = await getProjectSummary(await login.ceo(), ids.projects.payments, "day");
    expect(summary.done.map(i => i.taskId)).toEqual([webhook.id]);
    expect(summary.stats.completed).toBe(1);
  });

  it("flags overdue tasks and blocker comments, and falls back to the facts when the model writes no note", async () => {
    fakeProvider(() => ({ headline: "Two things are stuck.", done: [], inProgress: [], blocked: [] }));
    const polling = await task("Payment status polling");
    await polling.update({ dueDate: new Date(Date.now() - 2 * 86_400_000) });
    const refund = await task("Refund API");
    await addComment(await login.pm(), refund.id, { content: "Waiting on finance to confirm the refund policy" });

    const { summary } = await getProjectSummary(await login.ceo(), ids.projects.payments, "day");
    const blocked = new Map(summary.blocked.map(i => [i.taskId, i.note]));
    expect(blocked.get(polling.id)).toMatch(/overdue since/);
    expect(blocked.get(refund.id)).toMatch(/recent comment: "Waiting on finance/);
    // A blocked task is listed once, not also under in progress.
    expect(summary.inProgress.map(i => i.taskId)).not.toContain(polling.id);
  });

  it("drops notes for tasks the model made up or that belong elsewhere", async () => {
    fakeProvider(() => ({
      headline: "Done.",
      done: [{ key: "PAY-99", note: "invented" }],
      inProgress: [
        { key: "UP-1", note: "another project" },
        { key: "DW-1", note: "another company" },
      ],
      blocked: [],
    }));
    const { summary } = await getProjectSummary(await login.ceo(), ids.projects.payments, "week");
    const all = [...summary.done, ...summary.inProgress, ...summary.blocked];
    expect(all.map(i => i.key).every(k => k.startsWith("PAY-"))).toBe(true);
    expect(all.some(i => /invented|another/.test(i.note))).toBe(false);
  });

  it("calls no model when nothing happened", async () => {
    const { calls } = echoModel();
    const { summary } = await getProjectSummary(await login.ceo(), ids.projects.mobile, "week");
    expect(calls).toHaveLength(0);
    expect(summary.model).toBeNull();
    expect(summary.headline).toMatch(/Nothing happened/);
  });
});

describe("who may read a summary", () => {
  it("project: anyone who can see the project, a viewer included; others get 404", async () => {
    echoModel();
    await expect(getProjectSummary(await login.viewer(), ids.projects.payments, "week")).resolves.toBeTruthy();
    await expect(getProjectSummary(await login.viewer(), ids.projects.userPlatform, "week")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getProjectSummary(await login.globexCeo(), ids.projects.payments, "week")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("team: its members yes; a PM who sees only one of its projects no", async () => {
    echoModel();
    const team = await engineeringId();
    await expect(getTeamSummary(await login.dev1(), team, "week")).resolves.toBeTruthy();
    await expect(getTeamSummary(await login.pm(), team, "week")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("company: leadership only", async () => {
    echoModel();
    await expect(getCompanySummary(await login.ceo(), "week")).resolves.toBeTruthy();
    for (const who of [login.pm, login.lead, login.dev1, login.viewer]) {
      await expect(getCompanySummary(await who(), "week")).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});

describe("cost controls", () => {
  it("one cached summary serves every reader until someone regenerates it", async () => {
    const { calls } = echoModel();
    expect((await getProjectSummary(await login.ceo(), ids.projects.payments, "week")).cacheHit).toBe(false);
    expect((await getProjectSummary(await login.viewer(), ids.projects.payments, "week")).cacheHit).toBe(true);
    expect(calls).toHaveLength(1);

    await getProjectSummary(await login.pm(), ids.projects.payments, "week", true);
    expect(calls).toHaveLength(2);
  });

  it("refuses once a user has used their hourly requests", async () => {
    const { calls } = echoModel();
    const ceo = await login.ceo();
    await redis.set(limitKeys.aiUserHour(ceo.user.id, thisHour()), 50);
    await expect(getProjectSummary(ceo, ids.projects.payments, "week")).rejects.toBeInstanceOf(RateLimitedError);
    expect(calls).toHaveLength(0);
  });

  it("refuses once the company has used its daily token budget", async () => {
    echoModel();
    const ceo = await login.ceo();
    await redis.set(limitKeys.aiCompanyTokensDay(ceo.company.id, today()), 100_000);
    await expect(getProjectSummary(ceo, ids.projects.payments, "week")).rejects.toBeInstanceOf(RateLimitedError);
  });

  it("adds the tokens each call used to the company's budget", async () => {
    echoModel();
    const ceo = await login.ceo();
    await getProjectSummary(ceo, ids.projects.payments, "week");
    expect(await redis.get(limitKeys.aiCompanyTokensDay(ceo.company.id, today()))).toBe("100");
  });

  it("answers AI_DISABLED when no key is configured", async () => {
    const key = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      await expect(getProjectSummary(await login.ceo(), ids.projects.payments, "week")).rejects.toBeInstanceOf(AiDisabledError);
    } finally {
      process.env.GEMINI_API_KEY = key;
    }
  });
});
