import type { NextAuthConfig } from "next-auth";

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
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
