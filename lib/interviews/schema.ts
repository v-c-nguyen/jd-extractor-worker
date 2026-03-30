import { z } from "zod";

const dateYmd = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const optionalDateYmd = z.union([dateYmd, z.null()]).optional();

export const interviewResultValues = ["Booked", "Rescheduled", "Completed"] as const;
export const interviewPassStatusValues = ["Pending", "Passed", "Failed"] as const;
export const interviewStageValues = [
  "Initial",
  "HR Manager",
  "Technical",
  "Final",
  "Pre-Offer",
] as const;

export const createInterviewSchema = z.object({
  profileId: z.string().uuid(),
  interviewDate: dateYmd,
  appliedDate: optionalDateYmd,
  bookedDate: optionalDateYmd,
  interviewType: z.string().trim().min(1).max(200),
  result: z.enum(interviewResultValues),
  passStatus: z.enum(interviewPassStatusValues),
  stage: z.enum(interviewStageValues),
  meetingWhere: z.string().trim().min(1).max(200),
  practiceField: z.string().trim().min(1).max(200),
  company: z.string().trim().max(500).optional().default(""),
  resume: z.string().trim().max(20000).optional().default(""),
  jd: z.string().trim().max(20000).optional().default(""),
  note: z.string().trim().max(10000).optional().default(""),
});

export const patchInterviewSchema = z
  .object({
    profileId: z.string().uuid().optional(),
    interviewDate: dateYmd.optional(),
    appliedDate: optionalDateYmd,
    bookedDate: optionalDateYmd,
    interviewType: z.string().trim().min(1).max(200).optional(),
    result: z.enum(interviewResultValues).optional(),
    passStatus: z.enum(interviewPassStatusValues).optional(),
    stage: z.enum(interviewStageValues).optional(),
    meetingWhere: z.string().trim().min(1).max(200).optional(),
    practiceField: z.string().trim().min(1).max(200).optional(),
    company: z.string().trim().max(500).optional(),
    resume: z.string().trim().max(20000).optional(),
    jd: z.string().trim().max(20000).optional(),
    note: z.string().trim().max(10000).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field is required" });

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type PatchInterviewInput = z.infer<typeof patchInterviewSchema>;
