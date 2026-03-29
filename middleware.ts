import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!isAuthed && pathname !== "/signin") {
    const signIn = new URL("/signin", req.nextUrl.origin);
    signIn.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(signIn);
  }

  if (isAuthed && pathname === "/signin") {
    return NextResponse.redirect(new URL("/me", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
