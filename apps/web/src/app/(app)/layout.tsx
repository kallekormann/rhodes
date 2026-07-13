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
    .select("display_name, avatar_url")
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
      }}
    >
      {children}
    </AppShell>
  );
}
