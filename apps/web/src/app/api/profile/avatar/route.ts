import { NextResponse } from "next/server";
import { createAdminClient } from "@rhodes/db";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  AVATAR_BUCKET,
  assertAvatarFile,
  avatarExtensionForContentType,
  avatarStoragePath,
  resolveAvatarImageContentType,
} from "@/lib/profile/avatar";
import {
  removeLocalAvatar,
  saveLocalAvatar,
} from "@/lib/profile/local-avatar-storage";
import { createClient } from "@/lib/supabase/server";

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

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return withSecurityHeaders(
      NextResponse.json({ error: "file required" }, { status: 400 }),
    );
  }

  const contentType = resolveAvatarImageContentType(file);
  if (!contentType) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Only images are supported" }, { status: 400 }),
    );
  }

  const validationError = assertAvatarFile(file);
  if (validationError) {
    return withSecurityHeaders(
      NextResponse.json({ error: validationError }, { status: 400 }),
    );
  }

  const ext = avatarExtensionForContentType(contentType);
  const path = avatarStoragePath(user.id, ext);
  const bytes = new Uint8Array(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(AVATAR_BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });

  if (uploadError) {
    if (process.env.NODE_ENV !== "production") {
      try {
        await saveLocalAvatar(path, bytes);
      } catch (localError) {
        const message =
          localError instanceof Error ? localError.message : "Local save failed";
        return withSecurityHeaders(
          NextResponse.json({ error: message }, { status: 400 }),
        );
      }
    } else {
      return withSecurityHeaders(
        NextResponse.json({ error: uploadError.message }, { status: 400 }),
      );
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        avatar_url: path,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("avatar_url")
    .single();

  if (profileError) {
    return withSecurityHeaders(
      NextResponse.json({ error: profileError.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({ avatar_url: profile.avatar_url }, { status: 200 }),
  );
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.avatar_url) {
    const admin = createAdminClient();
    await admin.storage.from(AVATAR_BUCKET).remove([profile.avatar_url]).catch(() => {});
    await removeLocalAvatar(profile.avatar_url);
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        avatar_url: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ avatar_url: null }));
}
