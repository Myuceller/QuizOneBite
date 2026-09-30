import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";

const action = process.argv[2];
if (!["migrate", "seed", "status"].includes(action)) {
  console.error("Usage: node --env-file-if-exists=.env.local scripts/db.mjs migrate|seed|status");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Run npm run db:env for local development.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
  application_name: "quizquiz-db-cli",
});
let inTransaction = false;

try {
  await client.connect();
  if (action === "status") {
    const result = await client.query(`
      SELECT (SELECT count(*) FROM quizquiz.schema_migrations)::int AS migrations,
        (SELECT count(*) FROM quizquiz.quizzes)::int AS quizzes,
        (SELECT count(*) FROM quizquiz.quiz_questions)::int AS questions
    `);
    console.log(JSON.stringify({ connected: true, ...result.rows[0] }));
  } else {
    await client.query("BEGIN");
    inTransaction = true;
    // Serialize seed/migration commands on a single connection, including concurrent invocations.
    await client.query("SELECT pg_advisory_xact_lock(187301, 1)");
    if (action === "migrate") {
      await client.query("CREATE SCHEMA IF NOT EXISTS quizquiz");
      await client.query(`CREATE TABLE IF NOT EXISTS quizquiz.schema_migrations (
        name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
      )`);
      const dir = new URL("../db/migrations/", import.meta.url);
      const files = (await readdir(dir)).filter((name) => /^\d+_[\w-]+\.sql$/.test(name)).sort();
      const applied = await client.query("SELECT name, checksum FROM quizquiz.schema_migrations");
      if (applied.rows.some((row) => !files.includes(row.name))) {
        throw new Error("Applied migration is missing from db/migrations.");
      }
      for (const name of files) {
        const sql = await readFile(new URL(name, dir), "utf8");
        const checksum = createHash("sha256").update(sql).digest("hex");
        const previous = applied.rows.find((row) => row.name === name);
        if (previous) {
          if (previous.checksum !== checksum) throw new Error(`Applied migration changed: ${name}. Add a new migration instead.`);
          continue;
        }
        await client.query(sql);
        await client.query("INSERT INTO quizquiz.schema_migrations (name, checksum) VALUES ($1, $2)", [name, checksum]);
        console.log(`Applied ${name}`);
      }
    } else {
      const sql = await readFile(new URL("../db/seed.sql", import.meta.url), "utf8");
      await client.query(sql);
    }
    await client.query("COMMIT");
    inTransaction = false;
    console.log(action === "migrate" ? "Migrations are up to date." : "Local sample is ready.");
  }
} catch (error) {
  if (inTransaction) await client.query("ROLLBACK").catch(() => {});
  // PG errors can include SQL values or connection details; emit only a diagnostic code.
  if (error.message?.startsWith("Applied migration")) console.error(error.message);
  else console.error(`Database ${action} failed (${error.code ?? "UNKNOWN"}). Check DB availability and configuration.`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
