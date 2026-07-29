import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, avatar_url, personal_onboarding_completed_at, org_upgrade_onboarding_pending, org_upgrade_onboarding_completed_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name?.trim() ||
    user.email?.split("@")[0] ||
    "User";

  return (
    <AppShell
      session={{
        userId: user.id,
        userEmail: user.email ?? "",
        displayName,
        avatarUrl: profile?.avatar_url ?? null,
        personalOnboardingCompletedAt:
          profile?.personal_onboarding_completed_at ?? null,
        orgUpgradeOnboardingPending: profile?.org_upgrade_onboarding_pending ?? false,
        orgUpgradeOnboardingCompletedAt:
          profile?.org_upgrade_onboarding_completed_at ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}
