import { z } from "zod";
import { ProjectStatus } from "@/lib/db/enums";
import { idSchema } from "./common";

export const projectStatusSchema = z.enum(Object.values(ProjectStatus) as [ProjectStatus, ...ProjectStatus[]]);

/** 2–6 uppercase letters/digits starting with a letter, e.g. PAY, UP, MOB. */
export const projectKeySchema = z
  .string()
  .trim()
  .transform(v => v.toUpperCase())
  .pipe(z.string().regex(/^[A-Z][A-Z0-9]{1,5}$/, "Use 2–6 letters or digits, starting with a letter"));

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  key: projectKeySchema,
  description: z.string().trim().max(1000).optional().nullable(),
  teamId: idSchema,
  projectManagerId: idSchema.optional().nullable(),
  status: projectStatusSchema.optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(1000).nullable(),
    status: projectStatusSchema,
    projectManagerId: idSchema.nullable(),
  })
  .partial()
  .refine(v => Object.keys(v).length > 0, { message: "Nothing to update" });
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectMemberSchema = z.object({ userId: idSchema });

export const projectListQuerySchema = z.object({
  teamId: idSchema.optional(),
  status: projectStatusSchema.optional(),
});
