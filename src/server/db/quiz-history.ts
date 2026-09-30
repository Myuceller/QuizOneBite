import "server-only";
import type { Pool } from "pg";
import type { QuizCategory, QuizDifficulty } from "@/features/quiz/domain/quiz";
import { getDatabasePool } from "./pool";

export type HistoryItem = {
  id: string; category: QuizCategory; difficulty: QuizDifficulty;
  question_count: number; created_at: Date;
};

export async function listQuizHistory(ownerId: string): Promise<HistoryItem[]> {
  const result = await getDatabasePool().query<HistoryItem>(`
    SELECT id, category, difficulty, question_count, created_at FROM quizquiz.quizzes
    WHERE owner_id = $1 ORDER BY created_at DESC, id DESC LIMIT 30
  `, [ownerId]);
  return result.rows;
}

/** Atomic per-account quota shared by every app process; no client identity fields. */
export async function consumePreviewQuota(userId: string, pool: Pool = getDatabasePool()): Promise<boolean> {
  const result = await pool.query(`
    INSERT INTO quizquiz.preview_limits (user_id, started_at, count)
    VALUES ($1, now(), 1)
    ON CONFLICT (user_id) DO UPDATE SET
      started_at = CASE WHEN preview_limits.started_at <= now() - interval '1 minute' THEN now() ELSE preview_limits.started_at END,
      count = CASE WHEN preview_limits.started_at <= now() - interval '1 minute' THEN 1 ELSE preview_limits.count + 1 END
    WHERE preview_limits.started_at <= now() - interval '1 minute' OR preview_limits.count < 10
    RETURNING count
  `, [userId]);
  return result.rowCount === 1;
}
