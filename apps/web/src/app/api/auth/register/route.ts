import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { checkRegisterLimit } from "@/lib/auth/rate-limit";
import { registerSchema } from "@/lib/auth/schemas";
import { appUrl } from "@/lib/auth/urls";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const registerRequestSchema = registerSchema.extend({
  next: z.string().optional(),
});

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function safeNextPath(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limit = await checkRegisterLimit(ip);
  if (!limit.allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: limit.message }, { status: 429 }),
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = registerRequestSchema.safeParse(body);

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      ),
    );
  }

  const next = safeNextPath(parsed.data.next);
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: appUrl(`/auth/callback?next=${encodeURIComponent(next)}`),
    },
  });

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({
      ok: true,
      message: "Check your email to confirm your account.",
    }),
  );
}
