import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/auth/app-role";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: AppRole;
    };
  }

  interface User {
    role?: AppRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}
