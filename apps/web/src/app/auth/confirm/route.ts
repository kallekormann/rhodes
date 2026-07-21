import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { appUrl } from "@/lib/auth/urls";
import { createClient } from "@/lib/supabase/server";
import { getServerSupabaseUrl } from "@/lib/supabase/urls";

function redirectToLogin(error = "verify") {
  return NextResponse.redirect(appUrl(`/auth/login?error=${error}`));
}

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return null;
  }
  return next;
}

function resolvePostAuthRedirect(searchParams: URLSearchParams) {
  const redirectTo = searchParams.get("redirect_to");
  if (redirectTo) {
    try {
      const url = new URL(redirectTo);
      const next = safeNextPath(url.searchParams.get("next"));
      if (next) {
        return appUrl(next);
      }
    } catch {
      // fall through
    }
  }

  const next = safeNextPath(searchParams.get("next"));
  if (next) {
    return appUrl(next);
  }

  return appUrl("/documents");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "signup") as EmailOtpType;
  const postAuthRedirect = resolvePostAuthRedirect(searchParams);

  const supabase = await createClient();

  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) return redirectToLogin();

    if (type === "recovery") {
      return NextResponse.redirect(appUrl("/auth/reset-password"));
    }

    return NextResponse.redirect(postAuthRedirect);
  }

  if (!token) {
    return redirectToLogin();
  }

  const apiBase = getServerSupabaseUrl();
  if (!apiBase) {
    return redirectToLogin("config");
  }

  const redirectTo =
    searchParams.get("redirect_to") ?? appUrl("/auth/callback");
  const callbackUrl = new URL(redirectTo);

  const next = safeNextPath(callbackUrl.searchParams.get("next"));
  if (next) {
    callbackUrl.searchParams.set("next", next);
  }

  const verifyUrl = new URL("/auth/v1/verify", apiBase);
  verifyUrl.searchParams.set("token", token);
  verifyUrl.searchParams.set("type", type);
  verifyUrl.searchParams.set("redirect_to", callbackUrl.toString());

  const verifyRes = await fetch(verifyUrl.toString(), { redirect: "manual" });
  const location = verifyRes.headers.get("location");

  if (!location) {
    return redirectToLogin();
  }

  const redirectUrl = new URL(location);
  const code = redirectUrl.searchParams.get("code");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirectToLogin();

    if (type === "recovery") {
      return NextResponse.redirect(appUrl("/auth/reset-password"));
    }

    return NextResponse.redirect(postAuthRedirect);
  }

  return NextResponse.redirect(location);
}
