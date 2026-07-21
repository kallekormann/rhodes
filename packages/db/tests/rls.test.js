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

async function asUser(client, userId, fn) {
  await client.query(`set local role authenticated`);
  await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
  return fn();
}

async function asSuperuser(client, fn) {
  await client.query(`reset role`);
  return fn();
}

async function expectRlsDenied(client, run) {
  await client.query("SAVEPOINT rls_denied");
  try {
    await run();
    await client.query("ROLLBACK TO SAVEPOINT rls_denied");
    return false;
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT rls_denied");
    if (error && typeof error === "object" && error.code === "42501") {
      return true;
    }
    throw error;
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

    await asUser(client, userB, async () => {
      const denied = await client.query(
        `select count(*)::int as count from documents where id = $1`,
        [documentId],
      );
      if (denied.rows[0]?.count !== 0) {
        throw new Error("RLS failure: user B could read user A document");
      }
    });

    await asUser(client, userA, async () => {
      const allowed = await client.query(
        `select count(*)::int as count from documents where id = $1`,
        [documentId],
      );
      if (allowed.rows[0]?.count !== 1) {
        throw new Error("RLS failure: user A could not read own document");
      }
    });

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

    const teamWorkspace = await asSuperuser(client, () =>
      client.query(
        `insert into workspaces (name, is_team_workspace)
         values ('RLS Team', true)
         returning id`,
      ),
    );
    const teamWorkspaceId = teamWorkspace.rows[0]?.id;
    await asSuperuser(client, () =>
      client.query(
        `insert into workspace_members (workspace_id, user_id, role)
         values ($1, $2, 'owner'), ($1, $3, 'viewer')`,
        [teamWorkspaceId, userA, userB],
      ),
    );

    const teamDoc = await asSuperuser(client, () =>
      client.query(
        `insert into documents (workspace_id, created_by, title, content_plain)
         values ($1, $2, 'Team doc', 'team content')
         returning id`,
        [teamWorkspaceId, userA],
      ),
    );
    const teamDocumentId = teamDoc.rows[0]?.id;

    await asUser(client, userB, async () => {
      const viewerInsertBlocked = await expectRlsDenied(client, () =>
        client.query(
          `insert into documents (workspace_id, created_by, title, content_plain)
           values ($1, $2, 'Blocked', 'nope')
           returning id`,
          [teamWorkspaceId, userB],
        ),
      );
      if (!viewerInsertBlocked) {
        throw new Error("RLS failure: viewer could insert document");
      }

      const viewerUpdate = await client.query(
        `update documents set title = 'Hacked' where id = $1 returning id`,
        [teamDocumentId],
      );
      if (viewerUpdate.rows.length > 0) {
        throw new Error("RLS failure: viewer could update document");
      }
    });

    await asSuperuser(client, () =>
      client.query(
        `insert into document_shares (
           document_id, shared_by, grantee_type, grantee_user_id, label, permission
         ) values ($1, $2, 'user', $3, 'User B read', 'read')`,
        [documentId, userA, userB],
      ),
    );

    await asUser(client, userB, async () => {
      const readAllowed = await client.query(
        `select count(*)::int as count from documents where id = $1`,
        [documentId],
      );
      if (readAllowed.rows[0]?.count !== 1) {
        throw new Error("RLS failure: read-only share could not select document");
      }

      const readDenied = await client.query(
        `update documents set title = 'Changed' where id = $1 returning id`,
        [documentId],
      );
      if (readDenied.rows.length > 0) {
        throw new Error("RLS failure: read-only share could update document");
      }
    });

    await asSuperuser(client, () =>
      client.query(
        `update document_shares set permission = 'edit'
         where document_id = $1 and grantee_user_id = $2`,
        [documentId, userB],
      ),
    );

    await asSuperuser(client, () =>
      client.query(
        `insert into document_activity (
           document_id, workspace_id, actor_id, event_type, summary
         ) values ($1, $2, $3, 'content_edited', 'User A edited the document')`,
        [teamDocumentId, teamWorkspaceId, userA],
      ),
    );

    const inaccessibleDoc = await asSuperuser(client, () =>
      client.query(
        `insert into documents (workspace_id, created_by, title, content_plain)
         values ($1, $2, 'Private activity', 'hidden')
         returning id`,
        [workspaceId, userA],
      ),
    );
    const inaccessibleDocId = inaccessibleDoc.rows[0]?.id;

    await asSuperuser(client, () =>
      client.query(
        `insert into document_activity (
           document_id, workspace_id, actor_id, event_type, summary
         ) values ($1, $2, $3, 'content_edited', 'User A edited privately')`,
        [inaccessibleDocId, workspaceId, userA],
      ),
    );

    await asUser(client, userB, async () => {
      const editAllowed = await client.query(
        `update documents set title = 'Shared edit' where id = $1 returning id`,
        [documentId],
      );
      if (editAllowed.rows.length !== 1) {
        throw new Error("RLS failure: edit share could not update document");
      }
    });

    await asUser(client, userB, async () => {
      const activityDenied = await client.query(
        `select count(*)::int as count from document_activity where document_id = $1`,
        [inaccessibleDocId],
      );
      if (activityDenied.rows[0]?.count !== 0) {
        throw new Error(
          "RLS failure: user B could read activity for private document",
        );
      }
    });

    await asUser(client, userA, async () => {
      const webhooks = await client.query(`select count(*)::int as count from webhook_events`);
      if (webhooks.rows[0]?.count !== 0) {
        throw new Error("RLS failure: authenticated user could read webhook_events");
      }
    });

    await client.query("rollback");
    console.log("RLS Phase 08 tests passed.");
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
