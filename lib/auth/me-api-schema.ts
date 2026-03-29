import { z } from "zod";

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const dailyReportBodySchema = z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  body: z.string().min(1, "Report cannot be empty").max(20000),
});
