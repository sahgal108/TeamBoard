import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().max(254).transform(v => v.trim().toLowerCase()),
  password: z.string().min(8).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const switchCompanySchema = z.object({
  companyId: z.string().min(1).max(64),
});
export type SwitchCompanyInput = z.infer<typeof switchCompanySchema>;
