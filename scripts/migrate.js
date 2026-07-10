import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const migrationsDir = path.join(rootDir, "packages/db/migrations");

function loadEnvFile() {
  const envPath = path.join(rootDir, "docker/.env");
  return readFile(envPath, "utf8")
    .then((content) => {
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq);
        const value = trimmed.slice(eq + 1);
        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
    })
    .catch(() => undefined);
}

async function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const password = process.env.POSTGRES_PASSWORD;
  if (!password) {
    throw new Error("DATABASE_URL or POSTGRES_PASSWORD is required");
  }

  return `postgresql://postgres:${password}@localhost:5433/postgres`;
}

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz default now() not null
    )
  `);
}

async function main() {
  await loadEnvFile();
  const databaseUrl = await getDatabaseUrl();
  const client = new pg.Client({ connectionString: databaseUrl });

  await client.connect();
  await ensureMigrationsTable(client);

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const applied = await client.query(
    "select version from schema_migrations order by version",
  );
  const appliedSet = new Set(applied.rows.map((row) => row.version));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`skip ${file}`);
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`apply ${file}`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (version) values ($1)", [
        file,
      ]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  await client.end();
  console.log("Migrations complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
