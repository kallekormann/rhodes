import { NextResponse } from "next/server";
import { appUrl } from "@/lib/auth/urls";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const target = next.startsWith("/") ? appUrl(next) : appUrl("/");
      return NextResponse.redirect(target);
    }
  }

  return NextResponse.redirect(appUrl("/auth/login?error=callback"));
}
