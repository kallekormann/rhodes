import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const AUTH_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify",
  "/auth/confirm",
  "/auth/callback",
]);

const PUBLIC_API_PREFIXES = ["/api/health", "/api/auth/"];

function stripBasePath(pathname: string) {
  if (pathname === "/app") return "/";
  if (pathname.startsWith("/app/")) return pathname.slice(4);
  return pathname;
}

function isPublicPath(pathname: string) {
  const path = stripBasePath(pathname);

  if (AUTH_PATHS.has(path) || path.startsWith("/auth/")) {
    return true;
  }

  if (path.startsWith("/invite/")) {
    return true;
  }

  if (path.startsWith("/api/invites/") && !path.endsWith("/accept")) {
    return true;
  }

  return PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") ||
    pathname.startsWith("/app/supabase/") ||
    pathname.startsWith("/supabase/")
  ) {
    return NextResponse.next();
  }

  const { supabaseResponse, user } = await updateSession(request);

  if (!isPublicPath(pathname) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("next", stripBasePath(pathname));
    return NextResponse.redirect(loginUrl);
  }

  const authPath = stripBasePath(pathname);
  if (user && AUTH_PATHS.has(authPath) && authPath !== "/auth/callback") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
