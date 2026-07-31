import { NextResponse } from "next/server";
import { z } from "zod";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { getOrgPolicy, updateOrgPolicy } from "@/lib/scope-policies/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

const patchOrgPolicySchema = z.object({
  policy: z.record(z.unknown()),
});

export async function GET(_request: Request, context: RouteContext) {
  const { id: orgId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: isMember } = await supabase.rpc("is_org_member", {
    target_org_id: orgId,
  });
  if (!isMember) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  try {
    const policy = await getOrgPolicy(supabase, orgId);
    return withSecurityHeaders(NextResponse.json({ org_id: orgId, policy }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found";
    return withSecurityHeaders(
      NextResponse.json({ error: message }, { status: 404 }),
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: orgId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: isAdmin } = await supabase.rpc("is_org_admin", {
    target_org_id: orgId,
  });
  if (!isAdmin) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Only org admins can edit organization policy" }, {
        status: 403,
      }),
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

  const parsed = patchOrgPolicySchema.safeParse(body);
  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    );
  }

  try {
    const policy = await updateOrgPolicy(supabase, orgId, parsed.data.policy);
    return withSecurityHeaders(NextResponse.json({ org_id: orgId, policy }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return withSecurityHeaders(
      NextResponse.json({ error: message }, { status: 400 }),
    );
  }
}
