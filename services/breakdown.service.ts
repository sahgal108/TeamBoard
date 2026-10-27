import { z } from "zod";
import { UNTRUSTED_DATA_RULE, untrusted } from "@/lib/ai/provider";
import { generateJson } from "@/lib/ai/usage";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { authorizeTask } from "@/lib/authorization/task-access";
import type { TaskPriority } from "@/lib/db/enums";
import { Project, Task } from "@/lib/db/models";
import { ValidationError } from "@/lib/errors";
import { taskPrioritySchema } from "@/validations/task.schema";

export type SubtaskSuggestion = { title: string; description: string; priority: TaskPriority };

export type BreakdownSuggestions = {
  parent: { id: string; key: string; title: string };
  suggestions: SubtaskSuggestion[];
  model: string;
};

/** Same limits as a task created by hand, so a suggestion can always be saved as is. */
const modelReplySchema = z.object({
  subtasks: z
    .array(
      z.object({
        title: z.string().min(1).max(140),
        description: z.string().max(600),
        priority: taskPrioritySchema,
      }),
    )
    .min(1)
    .max(8),
});

const SYSTEM_PROMPT = [
  "You help a project manager split one task into subtasks in a project-management app.",
  "Return 3 to 8 subtasks that together complete the task. Each must be a concrete piece of work one person can finish in a day or two.",
  "Title: imperative, at most 10 words, no task keys or numbering. Description: one or two sentences on what done means.",
  "Priority: LOW, MEDIUM, HIGH or URGENT, relative to the parent task's priority; most should match it.",
  "Do not repeat subtasks that already exist. Do not assign people or invent dates.",
  UNTRUSTED_DATA_RULE,
].join("\n");

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Suggests subtasks for one top-level task. Nothing is saved: the person reviews and edits the
 * list, then creates the ones they want (createSubtasks). Not cached, since each request is
 * meant to give a fresh suggestion; the AI usage limits apply.
 */
export async function suggestSubtasks(ctx: CompanyContext, taskId: string): Promise<BreakdownSuggestions> {
  const { task } = await authorizeTask(ctx, taskId, "ai:breakdown");
  if (task.parentId) throw new ValidationError(undefined, "A subtask cannot be broken down further");

  const [details, project, existing] = await Promise.all([
    Task.findOne({ where: { id: task.id, companyId: ctx.company.id }, attributes: ["description"], rejectOnEmpty: true }),
    Project.findOne({ where: { id: task.projectId, companyId: ctx.company.id }, attributes: ["name", "description"], rejectOnEmpty: true }),
    Task.findAll({ where: { parentId: task.id, companyId: ctx.company.id }, attributes: ["title"] }),
  ]);

  const prompt = [
    "Break this task into subtasks.",
    untrusted("project", { name: project.name, description: project.description }),
    untrusted("task", { title: task.title, description: details.description, priority: task.priority }),
    untrusted("existingSubtasks", existing.map(s => s.title)),
  ].join("\n\n");

  const { value, model } = await generateJson(ctx, { feature: "breakdown", system: SYSTEM_PROMPT, prompt, schema: modelReplySchema, temperature: 0.4 });

  // Drop duplicates of each other, of existing subtasks and of the parent itself.
  const seen = new Set([normalise(task.title), ...existing.map(s => normalise(s.title))]);
  const suggestions: SubtaskSuggestion[] = [];
  for (const s of value.subtasks) {
    const title = s.title.trim().replace(/^[A-Z][A-Z0-9]{1,5}-\d+\s*[:-]?\s*/, "");
    const key = normalise(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    suggestions.push({ title, description: s.description.trim(), priority: s.priority });
  }

  return { parent: { id: task.id, key: `${task.project.key}-${task.number}`, title: task.title }, suggestions, model };
}
