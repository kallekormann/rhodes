import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { getMailConfig } from "@/lib/mail/config";
import { sendTeamInviteEmail } from "@/lib/mail/send";
import { inviteMemberSchema } from "@/lib/workspaces/members";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id: workspaceId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: isAdmin } = await supabase.rpc("is_workspace_admin", {
    ws_id: workspaceId,
  });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    !isAdmin ||
    !membership?.role ||
    (membership.role !== "owner" && membership.role !== "admin")
  ) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Only team owners and admins can invite members" },
        { status: 403 },
      ),
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

  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    );
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, name, is_team_workspace")
    .eq("id", workspaceId)
    .single();

  if (workspaceError || !workspace?.is_team_workspace) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Invites are only for team scopes" }, { status: 400 }),
    );
  }

  const { data: inviterProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const inviterName =
    inviterProfile?.display_name?.trim() ||
    user.email?.split("@")[0] ||
    "A teammate";

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const inviteEmail = parsed.data.email.toLowerCase();
  const inviteRole = parsed.data.role;

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("[invite] admin client:", error);
    return withSecurityHeaders(
      NextResponse.json({ error: "Couldn't create invite" }, { status: 500 }),
    );
  }

  const { data: inviteRow, error: insertError } = await admin
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      email: inviteEmail,
      role: inviteRole,
      invited_by: user.id,
      token,
      expires_at: expiresAt,
    })
    .select("id, email, role, expires_at, created_at")
    .single();

  if (insertError) {
    return withSecurityHeaders(
      NextResponse.json({ error: insertError.message }, { status: 400 }),
    );
  }

  const origin = new URL(request.url).origin;
  const inviteUrl = `${origin}/app/invite/${token}`;
  const mailConfigured = getMailConfig() !== null;
  let emailSent = false;
  let emailError: string | null = null;

  if (mailConfigured) {
    try {
      await sendTeamInviteEmail({
        to: parsed.data.email.toLowerCase(),
        inviteUrl,
        scopeName: workspace.name,
        inviterName,
        role: parsed.data.role,
      });
      emailSent = true;
    } catch (error) {
      emailError =
        error instanceof Error ? error.message : "Couldn't send invite email";
      console.error("[invite] email failed:", emailError, {
        host: getMailConfig()?.host,
        port: getMailConfig()?.port,
      });
    }
  } else {
    emailError = "SMTP_HOST is not set in apps/web/.env.local";
    console.warn(
      "[invite] SMTP not configured — invite saved but no email sent. Set SMTP_HOST in apps/web/.env.local and restart the dev server.",
    );
  }

  return withSecurityHeaders(
    NextResponse.json({
      ok: true,
      invite_url: inviteUrl,
      email_sent: emailSent,
      email_error: emailError,
      pending_invite: inviteRow
        ? {
            id: inviteRow.id,
            email: inviteRow.email,
            role: inviteRow.role === "admin" ? "admin" : inviteRow.role === "viewer" ? "viewer" : "member",
            expires_at: inviteRow.expires_at,
            created_at: inviteRow.created_at,
          }
        : null,
    }),
  );
}
