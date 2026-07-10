import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../..");

async function loadEnv() {
  const content = await readFile(path.join(rootDir, "docker/.env"), "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
}

async function main() {
  await loadEnv();
  const password = process.env.POSTGRES_PASSWORD;
  if (!password) throw new Error("POSTGRES_PASSWORD missing");

  const client = new pg.Client({
    connectionString:
      process.env.DATABASE_URL ??
      `postgresql://postgres:${password}@localhost:5433/postgres`,
  });
  await client.connect();

  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();

  await client.query("begin");
  try {
    await client.query(
      `insert into auth.users (id, email) values ($1, 'rls-a@test.local'), ($2, 'rls-b@test.local')`,
      [userA, userB],
    );

    const workspaceA = await client.query(
      `select workspace_id from workspace_members where user_id = $1 limit 1`,
      [userA],
    );
    const workspaceId = workspaceA.rows[0]?.workspace_id;
    if (!workspaceId) throw new Error("Missing workspace for user A");

    const document = await client.query(
      `insert into documents (workspace_id, created_by, title, content_plain)
       values ($1, $2, 'Secret', 'classified')
       returning id`,
      [workspaceId, userA],
    );
    const documentId = document.rows[0]?.id;

    await client.query(`set local role authenticated`);
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [
      userB,
    ]);
    const denied = await client.query(
      `select count(*)::int as count from documents where id = $1`,
      [documentId],
    );
    if (denied.rows[0]?.count !== 0) {
      throw new Error("RLS failure: user B could read user A document");
    }

    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [
      userA,
    ]);
    const allowed = await client.query(
      `select count(*)::int as count from documents where id = $1`,
      [documentId],
    );
    if (allowed.rows[0]?.count !== 1) {
      throw new Error("RLS failure: user A could not read own document");
    }

    const memberships = await client.query(
      `select workspace_id, role from workspace_members`,
    );
    if (memberships.rows.length < 1) {
      throw new Error("RLS failure: user A could not read workspace memberships");
    }

    const bootstrap = await client.query(
      `select public.bootstrap_user_workspace() as workspace_id`,
    );
    if (!bootstrap.rows[0]?.workspace_id) {
      throw new Error("bootstrap_user_workspace failed under RLS");
    }

    const inserted = await client.query(
      `insert into documents (workspace_id, created_by, title, content_plain)
       values ($1, $2, 'RLS insert test', 'ok')
       returning id`,
      [workspaceId, userA],
    );
    if (!inserted.rows[0]?.id) {
      throw new Error("RLS failure: could not insert and return document");
    }

    await client.query("rollback");
    console.log("RLS cross-workspace denial test passed.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
