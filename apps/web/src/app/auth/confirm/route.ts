import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { appUrl } from "@/lib/auth/urls";
import { createClient } from "@/lib/supabase/server";

function redirectToLogin(error = "verify") {
  return NextResponse.redirect(appUrl(`/auth/login?error=${error}`));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "signup") as EmailOtpType;

  const supabase = await createClient();

  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) return redirectToLogin();

    if (type === "recovery") {
      return NextResponse.redirect(appUrl("/auth/reset-password"));
    }

    return NextResponse.redirect(appUrl("/auth/verify"));
  }

  if (!token) {
    return redirectToLogin();
  }

  const apiBase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!apiBase) {
    return redirectToLogin("config");
  }

  const callbackUrl = appUrl("/auth/callback");
  const verifyUrl = new URL("/auth/v1/verify", apiBase);
  verifyUrl.searchParams.set("token", token);
  verifyUrl.searchParams.set("type", type);
  verifyUrl.searchParams.set("redirect_to", callbackUrl);

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

    return NextResponse.redirect(appUrl("/auth/verify"));
  }

  return NextResponse.redirect(location);
}
