import { z } from "zod";

const contactInput = z.object({
  label: z.string().max(200).optional(),
  value: z.string().trim().min(1).max(2000),
});

export const createBidderSchema = z.object({
  name: z.string().trim().min(1).max(500),
  /** Login email for app_users (dashboard /me). Initial password is set server-side. */
  loginEmail: z.string().trim().email().transform((s) => s.toLowerCase()),
  country: z.string().trim().min(1).max(200),
  contacts: z.array(contactInput).min(1),
  rateCurrency: z
    .string()
    .trim()
    .min(3)
    .max(3)
    .transform((s) => s.toUpperCase()),
  rateAmount: z.coerce.number().finite().nonnegative(),
  status: z.string().trim().min(1).max(100),
  role: z.string().trim().min(1).max(200),
  note: z.string().trim().max(10000).optional().default(""),
});

export const patchBidderSchema = z
  .object({
    name: z.string().trim().min(1).max(500).optional(),
    country: z.string().trim().min(1).max(200).optional(),
    contacts: z.array(contactInput).min(1).optional(),
    rateCurrency: z
      .string()
      .trim()
      .min(3)
      .max(3)
      .transform((s) => s.toUpperCase())
      .optional(),
    rateAmount: z.coerce.number().finite().nonnegative().optional(),
    status: z.string().trim().min(1).max(100).optional(),
    role: z.string().trim().min(1).max(200).optional(),
    note: z.string().trim().max(10000).optional(),
    appUserId: z.union([z.string().uuid(), z.null()]).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field is required" });

export type CreateBidderInput = z.infer<typeof createBidderSchema>;
export type PatchBidderInput = z.infer<typeof patchBidderSchema>;
