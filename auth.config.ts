import type { NextAuthConfig } from "next-auth";
import { normalizeAppRole } from "@/lib/auth/app-role";

/**
 * Edge-safe config (no DB / bcrypt). Used by middleware. Full providers live in `auth.ts`.
 */
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/signin" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      const u = user as { role?: string } | undefined;
      if (u?.role !== undefined) {
        token.role = u.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      if (session.user) {
        session.user.role = normalizeAppRole(token.role as string | undefined);
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
