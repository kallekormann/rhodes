import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { getAccountLibraryQuota } from "@/lib/library/account-quota";
import { resolveServerTier } from "@/lib/features/server-gates";
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

  try {
    const quota = await getAccountLibraryQuota(user.id, resolveServerTier());
    return withSecurityHeaders(NextResponse.json(quota));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load library quota";
    return withSecurityHeaders(
      NextResponse.json({ error: message }, { status: 500 }),
    );
  }
}
