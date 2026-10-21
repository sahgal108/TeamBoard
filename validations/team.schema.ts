import { z } from "zod";
import { idSchema } from "./common";

export const createTeamSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional().nullable(),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = createTeamSchema.partial().refine(v => Object.keys(v).length > 0, { message: "Nothing to update" });
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

export const teamMemberSchema = z.object({ userId: idSchema });
