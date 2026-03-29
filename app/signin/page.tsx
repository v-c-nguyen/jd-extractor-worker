import { Suspense } from "react";
import { SignInForm } from "@/components/account/sign-in-form";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm ring-1 ring-primary/20">
          JD
        </span>
        <span className="text-lg font-semibold tracking-tight text-foreground">Extractor</span>
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
