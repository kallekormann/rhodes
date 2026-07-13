import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ token: string }>;
};

type InvitePreview = {
  valid: boolean;
  reason?: string;
  workspace_name?: string;
  email?: string;
  role?: string;
  expires_at?: string;
};

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_workspace_invite_preview", {
    invite_token: token,
  });

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  const preview = (data ?? { valid: false }) as InvitePreview;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const signedInEmail = user?.email?.toLowerCase() ?? "";
  const inviteEmail = preview.email?.toLowerCase() ?? "";

  return withSecurityHeaders(
    NextResponse.json({
      preview,
      signed_in: Boolean(user),
      signed_in_email: signedInEmail || null,
      email_matches: Boolean(
        user &&
          preview.valid &&
          inviteEmail &&
          signedInEmail &&
          inviteEmail === signedInEmail,
      ),
    }),
  );
}
