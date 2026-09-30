import "server-only";
import { Pool } from "pg";
import { QuizStorageError } from "@/features/quiz/domain/storage-error";

const globalForDatabase = globalThis as typeof globalThis & { quizquizPool?: Pool };

/** Lazy, bounded pool, shared across Next.js development hot reloads. */
export function getDatabasePool(): Pool {
  if (globalForDatabase.quizquizPool) return globalForDatabase.quizquizPool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new QuizStorageError("DATABASE_CONFIGURATION_ERROR");
  try {
    const url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("Invalid protocol");
  } catch {
    throw new QuizStorageError("DATABASE_CONFIGURATION_ERROR");
  }
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10_000,
    application_name: "quizquiz-web",
  });
  pool.on("error", () => console.error("[database] Idle connection failed."));
  globalForDatabase.quizquizPool = pool;
  return pool;
}
