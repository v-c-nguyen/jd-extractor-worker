import { z } from "zod";

const dateStr = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "workDate must be YYYY-MM-DD");

const countField = z.coerce.number().int().min(0).max(1_000_000);

export const createBidderWorkSchema = z.object({
  workDate: dateStr,
  bidCount: countField,
  interviewCount: countField,
});

export const patchBidderWorkSchema = z
  .object({
    workDate: dateStr.optional(),
    bidCount: countField.optional(),
    interviewCount: countField.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field is required" });

export type CreateBidderWorkInput = z.infer<typeof createBidderWorkSchema>;
export type PatchBidderWorkInput = z.infer<typeof patchBidderWorkSchema>;
