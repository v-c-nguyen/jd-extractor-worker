export type AppRole = "administrator" | "manager" | "bidder";

export function normalizeAppRole(raw: string | null | undefined): AppRole {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "administrator") return "administrator";
  if (s === "manager") return "manager";
  return "bidder";
}
