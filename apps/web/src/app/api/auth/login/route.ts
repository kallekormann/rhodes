import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { checkLoginLimit } from "@/lib/auth/rate-limit";
import { loginSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      ),
    );
  }

  const limit = await checkLoginLimit(parsed.data.email);
  if (!limit.allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: limit.message }, { status: 429 }),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 401 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ ok: true }));
}

export async function GET() {
  return withSecurityHeaders(NextResponse.json({ error: "Method not allowed" }, { status: 405 }));
}
