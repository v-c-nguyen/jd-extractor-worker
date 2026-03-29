import { z } from "zod";

const dateStr = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "occurredOn must be YYYY-MM-DD");

const networkEnum = z.enum(["BEP20", "ERC20", "OTHER"]);
const statusEnum = z.enum(["Pending", "Confirmed", "Paid"]);

const amountField = z.coerce
  .number()
  .finite()
  .min(0)
  .max(1e18, "amount is too large");

const entryTypeField = z.string().trim().min(1, "type is required").max(200);
const txHashCreate = z
  .string()
  .trim()
  .max(200)
  .default("");

const txHashPatch = z.string().trim().max(200).optional();

export const createBidderTransactionSchema = z.object({
  occurredOn: dateStr,
  entryType: entryTypeField,
  amount: amountField,
  network: networkEnum,
  status: statusEnum,
  txHash: txHashCreate,
});

export const patchBidderTransactionSchema = z
  .object({
    occurredOn: dateStr.optional(),
    entryType: entryTypeField.optional(),
    amount: amountField.optional(),
    network: networkEnum.optional(),
    status: statusEnum.optional(),
    txHash: txHashPatch,
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field is required" });

export type CreateBidderTransactionInput = z.infer<typeof createBidderTransactionSchema>;
export type PatchBidderTransactionInput = z.infer<typeof patchBidderTransactionSchema>;
