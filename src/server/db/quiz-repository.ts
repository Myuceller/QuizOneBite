import "server-only";
import type { Pool, PoolClient } from "pg";
import { QuizDraftSchema, type QuizDraft } from "@/features/quiz/domain/quiz";
import { QuizStorageError } from "@/features/quiz/domain/storage-error";
import type { QuizRepository } from "@/features/quiz/ports/quiz-repository";
import { getDatabasePool } from "./pool";

export class PostgresQuizRepository implements QuizRepository {
  constructor(private readonly pool: Pool, private readonly ownerId?: string) {}

  async save(input: QuizDraft): Promise<void> {
    const quiz = QuizDraftSchema.parse(input);
    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query("BEGIN");
      await client.query(`
        INSERT INTO quizquiz.quizzes
          (id, category, difficulty, question_count, provider, model, prompt_version, verification_status, owner_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [quiz.id, quiz.category, quiz.difficulty, quiz.questions.length, quiz.metadata.provider,
        quiz.metadata.model, quiz.metadata.promptVersion, quiz.metadata.verificationStatus, this.ownerId ?? null]);
      for (const [position, question] of quiz.questions.entries()) {
        await client.query(`
          INSERT INTO quizquiz.quiz_questions
            (quiz_id, id, position, question, options, correct_answer_index, explanation)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [quiz.id, question.id, position, question.question, question.options,
          question.correctAnswerIndex, question.explanation]);
      }
      await client.query("COMMIT");
    } catch {
      await client?.query("ROLLBACK").catch(() => {});
      throw new QuizStorageError("DATABASE_UNAVAILABLE");
    } finally {
      client?.release();
    }
  }

  async findById(id: string): Promise<QuizDraft | null> {
    if (!QuizDraftSchema.shape.id.safeParse(id).success) return null;
    try {
      // One statement gives a consistent snapshot of the draft and all its questions.
      const result = await this.pool.query(`
        SELECT q.id, q.category, q.difficulty, q.question_count, q.provider, q.model,
          q.prompt_version, q.verification_status,
          COALESCE(jsonb_agg(jsonb_build_object(
            'id', item.id, 'question', item.question, 'options', item.options,
            'correctAnswerIndex', item.correct_answer_index, 'explanation', item.explanation
          ) ORDER BY item.position) FILTER (WHERE item.id IS NOT NULL), '[]'::jsonb) AS questions
        FROM quizquiz.quizzes q
        LEFT JOIN quizquiz.quiz_questions item ON item.quiz_id = q.id
        WHERE q.id = $1 AND ($2::text IS NULL OR q.owner_id = $2)
        GROUP BY q.id
      `, [id, this.ownerId ?? null]);
      const row = result.rows[0];
      if (!row) return null;
      const parsed = QuizDraftSchema.safeParse({
        id: row.id, category: row.category, difficulty: row.difficulty, questions: row.questions,
        metadata: { provider: row.provider, model: row.model,
          promptVersion: row.prompt_version, verificationStatus: row.verification_status },
      });
      if (!parsed.success || parsed.data.questions.length !== row.question_count) {
        throw new QuizStorageError("INVALID_STORED_QUIZ");
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof QuizStorageError) throw error;
      throw new QuizStorageError("DATABASE_UNAVAILABLE");
    }
  }
}

export function getQuizRepository(ownerId?: string): QuizRepository {
  return new PostgresQuizRepository(getDatabasePool(), ownerId);
}
