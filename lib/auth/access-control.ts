import type { AppRole } from "@/lib/auth/app-role";

/**
 * Route and API prefixes restricted by role:
 * - Administrator: full access
 * - Manager: no profiles (pages + /api/profiles)
 * - Bidder: no profiles and no bidders (pages + matching APIs)
 */
export function isPathForbiddenForRole(role: AppRole | null | undefined, pathname: string): boolean {
  const r = role ?? "bidder";
  if (r === "administrator") return false;

  const isProfiles =
    pathname === "/profiles" ||
    pathname.startsWith("/profiles/") ||
    pathname === "/api/profiles" ||
    pathname.startsWith("/api/profiles/");
  const isBidders =
    pathname === "/bidders" ||
    pathname.startsWith("/bidders/") ||
    pathname === "/api/bidders" ||
    pathname.startsWith("/api/bidders/");

  if (isBidders && r === "bidder") return true;
  if (isProfiles && (r === "bidder" || r === "manager")) return true;
  return false;
}
