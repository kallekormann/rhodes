import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { checkResetLimit } from "@/lib/auth/rate-limit";
import { forgotPasswordSchema } from "@/lib/auth/schemas";
import { appUrl } from "@/lib/auth/urls";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      ),
    );
  }

  const limit = await checkResetLimit(parsed.data.email);
  if (!limit.allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: limit.message }, { status: 429 }),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: appUrl("/auth/reset-password") },
  );

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({
      ok: true,
      message: "If that email exists, a reset link has been sent.",
    }),
  );
}
