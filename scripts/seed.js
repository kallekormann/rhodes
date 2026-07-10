import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

async function loadEnvFile() {
  const envPath = path.join(rootDir, "docker/.env");
  const content = await readFile(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    process.env[key] = value;
  }
}

const SEED_EMAIL = process.env.SEED_USER_EMAIL ?? "dev@rhodes.local";
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? "devpassword123";

async function main() {
  await loadEnvFile();

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { enabled: false },
  });

  const existing = await supabase.auth.admin.listUsers();
  let userId = existing.data.users.find((user) => user.email === SEED_EMAIL)?.id;

  if (!userId) {
    const created = await supabase.auth.admin.createUser({
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
      email_confirm: true,
    });

    if (created.error || !created.data.user) {
      throw created.error ?? new Error("Failed to create seed user");
    }

    userId = created.data.user.id;
    console.log(`Created seed user ${SEED_EMAIL}`);
  } else {
    console.log(`Seed user already exists: ${SEED_EMAIL}`);
  }

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1);

  let workspaceId = memberships?.[0]?.workspace_id;

  if (!workspaceId) {
    const workspace = await supabase
      .from("workspaces")
      .insert({ name: "Private", is_team_workspace: false })
      .select("id")
      .single();

    if (workspace.error || !workspace.data) {
      throw workspace.error ?? new Error("Failed to create workspace");
    }

    workspaceId = workspace.data.id;

    const member = await supabase.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: "owner",
    });

    if (member.error) {
      throw member.error;
    }

    console.log(`Created private workspace ${workspaceId}`);
  }

  const { data: existingDocs } = await supabase
    .from("documents")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1);

  if (!existingDocs?.length) {
    const document = await supabase.from("documents").insert({
      workspace_id: workspaceId,
      created_by: userId,
      title: "Welcome to Rhodes",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Your workspace is ready." }],
          },
        ],
      },
      content_plain: "Your workspace is ready.",
    });

    if (document.error) {
      throw document.error;
    }

    console.log("Inserted sample document");
  } else {
    console.log("Sample document already exists");
  }

  console.log("Seed complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
