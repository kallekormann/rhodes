import { NextResponse } from "next/server";
import { z } from "zod";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

const completeOnboardingSchema = z.object({
  step: z.enum([
    "personal",
    "org_upgrade",
    "tier_fork_skip",
    "org_setup_complete",
  ]),
  display_name: z.string().trim().min(1).max(80).optional(),
});

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

  const parsed = completeOnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    );
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    id: user.id,
    updated_at: now,
  };

  if (parsed.data.display_name !== undefined) {
    updates.display_name = parsed.data.display_name;
  }

  switch (parsed.data.step) {
    case "personal":
    case "tier_fork_skip":
    case "org_setup_complete":
      updates.personal_onboarding_completed_at = now;
      break;
    case "org_upgrade":
      updates.org_upgrade_onboarding_pending = false;
      updates.org_upgrade_onboarding_completed_at = now;
      updates.personal_onboarding_completed_at = now;
      break;
    default:
      break;
  }

  if (parsed.data.step === "org_setup_complete") {
    updates.org_upgrade_onboarding_pending = false;
    updates.org_upgrade_onboarding_completed_at = now;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .upsert(updates, { onConflict: "id" })
    .select(
      "display_name, personal_onboarding_completed_at, org_upgrade_onboarding_pending, org_upgrade_onboarding_completed_at",
    )
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
        personal_onboarding_completed_at: profile.personal_onboarding_completed_at,
        org_upgrade_onboarding_pending: profile.org_upgrade_onboarding_pending,
        org_upgrade_onboarding_completed_at:
          profile.org_upgrade_onboarding_completed_at,
      },
    }),
  );
}
