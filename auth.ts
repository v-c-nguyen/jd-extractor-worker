import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { findUserWithPasswordHashByEmail } from "@/lib/auth/user-repo";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const emailLower = parsed.data.email.trim().toLowerCase();
        const row = await findUserWithPasswordHashByEmail(emailLower);
        if (!row) return null;
        const valid = await compare(parsed.data.password, row.password_hash);
        if (!valid) return null;
        return {
          id: row.id,
          email: row.email,
          name: row.name,
        };
      },
    }),
  ],
});
