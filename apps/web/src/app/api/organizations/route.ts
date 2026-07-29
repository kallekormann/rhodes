import { NextResponse } from "next/server";
import { z } from "zod";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  requireTierFeature,
  resolveServerTier,
} from "@/lib/features/server-gates";
import { createClient } from "@/lib/supabase/server";

const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const tier = resolveServerTier();
  const tierCheck = requireTierFeature(tier, "org.create");
  if (!tierCheck.ok) {
    return withSecurityHeaders(
      NextResponse.json({ error: tierCheck.message }, { status: 403 }),
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

  const parsed = createOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    );
  }

  const { data: organization, error } = await supabase
    .from("organizations")
    .insert({
      name: parsed.data.name,
      created_by: user.id,
    })
    .select("id, name, created_at")
    .single();

  if (error || !organization) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: error?.message ?? "Could not create organization" },
        { status: 400 },
      ),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({ organization }, { status: 201 }),
  );
}
