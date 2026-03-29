"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      onClick={() => signOut({ callbackUrl: "/signin" })}
    >
      Sign out
    </Button>
  );
}
