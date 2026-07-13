import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { updateProfileSchema } from "@/lib/profile/schemas";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, email_preferences")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({
      profile: {
        display_name:
          profile?.display_name?.trim() ||
          user.email?.split("@")[0] ||
          "User",
        avatar_url: profile?.avatar_url ?? null,
        email: user.email ?? "",
        email_preferences: profile?.email_preferences ?? { knowledge_bridge: true },
      },
    }),
  );
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withSecurityHeaders(
      NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    );
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    );
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.display_name !== undefined) {
    updates.display_name = parsed.data.display_name;
  }

  if (parsed.data.email_preferences !== undefined) {
    updates.email_preferences = parsed.data.email_preferences;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...updates }, { onConflict: "id" })
    .select("display_name, avatar_url, email_preferences")
    .single();

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({
      profile: {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        email: user.email ?? "",
        email_preferences: profile.email_preferences,
      },
    }),
  );
}
