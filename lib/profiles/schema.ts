import { z } from "zod";

const emailInput = z.object({
  label: z.string().max(200).optional(),
  value: z.string().trim().email().max(320),
});

export const createProfileSchema = z.object({
  name: z.string().trim().min(1).max(500),
  country: z.string().trim().max(200).optional().default(""),
  status: z.string().trim().max(100).optional().default(""),
  field: z.string().trim().max(200).optional().default(""),
  linkedin: z.string().trim().max(2000).optional().default(""),
  github: z.string().trim().max(2000).optional().default(""),
  address: z.string().trim().max(2000).optional().default(""),
  bidderId: z.union([z.string().uuid(), z.null()]).optional(),
  emails: z.array(emailInput).default([]),
  note: z.string().trim().max(10000).optional().default(""),
});

export const patchProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(500).optional(),
    country: z.string().trim().max(200).optional(),
    status: z.string().trim().max(100).optional(),
    field: z.string().trim().max(200).optional(),
    linkedin: z.string().trim().max(2000).optional(),
    github: z.string().trim().max(2000).optional(),
    address: z.string().trim().max(2000).optional(),
    bidderId: z.union([z.string().uuid(), z.null()]).optional(),
    emails: z.array(emailInput).optional(),
    note: z.string().trim().max(10000).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field is required" });

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type PatchProfileInput = z.infer<typeof patchProfileSchema>;
