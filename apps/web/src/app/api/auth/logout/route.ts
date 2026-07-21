import { createServerClient } from "@supabase/ssr";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { getServerSupabaseUrl } from "@/lib/supabase/urls";

export async function POST(request: NextRequest) {
  const url = getServerSupabaseUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Auth is not configured" }, { status: 500 }),
    );
  }

  let response = NextResponse.json({ ok: true });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.signOut({ scope: "global" });
  revalidatePath("/", "layout");

  return withSecurityHeaders(response);
}
