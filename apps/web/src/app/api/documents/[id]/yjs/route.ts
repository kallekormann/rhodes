import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

/** Durable Yjs CRDT state for a document — the single source of truth for the body. */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data, error } = await supabase
    .from("document_yjs_state")
    .select("state, seq, updated_at")
    .eq("document_id", id)
    .maybeSingle();

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  if (!data?.state) {
    return withSecurityHeaders(
      NextResponse.json({ state: null, seq: 0, updated_at: null }),
    );
  }

  // Supabase returns bytea as a "\\x"-prefixed hex string over PostgREST.
  const raw = data.state as unknown as string;
  const hex = raw.startsWith("\\x") ? raw.slice(2) : raw;
  const bytes = Buffer.from(hex, "hex");

  return withSecurityHeaders(
    NextResponse.json({
      state: bytes.toString("base64"),
      seq: data.seq ?? 0,
      updated_at: data.updated_at ?? null,
    }),
  );
}

/** POST is a sendBeacon-compatible alias of PUT (Beacon API only sends POST). */
export async function POST(request: Request, context: RouteContext) {
  return PUT(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const state = typeof body?.state === "string" ? body.state : null;

  if (!state) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Missing state" }, { status: 400 }),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(state, "base64");
  } catch {
    return withSecurityHeaders(
      NextResponse.json({ error: "Invalid state encoding" }, { status: 400 }),
    );
  }

  const hexState = `\\x${bytes.toString("hex")}`;

  const { data: existing } = await supabase
    .from("document_yjs_state")
    .select("seq")
    .eq("document_id", id)
    .maybeSingle();

  const { error } = await supabase.from("document_yjs_state").upsert({
    document_id: id,
    state: hexState,
    seq: (existing?.seq ?? 0) + 1,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ ok: true }));
}
