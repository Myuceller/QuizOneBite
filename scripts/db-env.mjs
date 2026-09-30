import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";

const file = new URL("../.env.local", import.meta.url);
let contents = "";
try {
  contents = await readFile(file, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const env = parseEnv(contents);
const additions = [];
if (!env.BETTER_AUTH_SECRET) additions.push(`BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}`);
if (!env.BETTER_AUTH_URL) additions.push("BETTER_AUTH_URL=http://127.0.0.1:3000");
if (env.DATABASE_URL) {
  console.log("Existing DATABASE_URL preserved. For local Docker, POSTGRES_PASSWORD must match it.");
} else {
  const password = env.POSTGRES_PASSWORD || randomBytes(24).toString("hex");
  if (!env.POSTGRES_PASSWORD) additions.push(`POSTGRES_PASSWORD=${JSON.stringify(password)}`);
  if (!env.AI_PROVIDER) additions.push("AI_PROVIDER=mock");
  additions.push(`DATABASE_URL=postgresql://quizquiz:${encodeURIComponent(password)}@127.0.0.1:5433/quizquiz`);
}
if (additions.length) {
  await writeFile(file, `${contents.trimEnd()}\n${additions.join("\n")}\n`, { mode: 0o600 });
  console.log("Local database/auth settings saved to .env.local (secrets not printed).");
}
