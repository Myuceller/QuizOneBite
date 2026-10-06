import 'server-only';
import { randomInt } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PlayRepository } from '@/features/play/ports/play-repository';
import { PlayError, type PlaySession, type PlayHistory, type Rating, type ReportReason, type Source, type StartPlay } from '@/features/play/domain/play';
import { selectQuestions, shuffleOptions, type Candidate } from '@/features/play/domain/selection';
import { getDatabasePool } from './pool';

type BankRow = Candidate & { question: string; options: string[]; correct_answer_index: number; explanation: string; sources: Source[] };
type ItemRow = {
  question_id: string; position: number; question: string; options: string[]; is_review: boolean;
  selected_index: number | null; correct_answer_index: number; explanation: string; sources: Source[];
  rating_value: number | null; rating_reason: 'obvious' | 'ambiguous' | 'options' | null; reported: boolean;
};
type Queryable = Pick<Pool, 'query'>;
const random = () => randomInt(0, 1_000_000) / 1_000_000;
const missing = () => new PlayError('NOT_FOUND', '문제 기록을 찾을 수 없어요.', 404);

async function readSession(db: Queryable, userId: string, id: string): Promise<PlaySession> {
  const session = await db.query('SELECT id, category, difficulty, completed_at FROM quizquiz.play_sessions WHERE id=$1 AND user_id=$2', [id, userId]);
  if (!session.rowCount) throw missing();
  const items = await db.query<ItemRow>(`
    SELECT i.*, r.value AS rating_value, r.reason AS rating_reason,
      EXISTS(SELECT 1 FROM quizquiz.question_reports p WHERE p.question_id=i.question_id AND p.user_id=$2) AS reported
    FROM quizquiz.play_items i
    LEFT JOIN quizquiz.question_ratings r ON r.question_id=i.question_id AND r.user_id=$2
    WHERE i.session_id=$1 ORDER BY i.position
  `, [id, userId]);
  return {
    id, category: session.rows[0].category, difficulty: session.rows[0].difficulty,
    completed: !!session.rows[0].completed_at,
    score: items.rows.filter(i => i.selected_index !== null && i.selected_index === i.correct_answer_index).length,
    questions: items.rows.map(i => ({
      id: i.question_id, position: i.position, question: i.question, options: i.options, isReview: i.is_review,
      rating: i.rating_value === 1 ? { value: 1 } : i.rating_value === -1 ? { value: -1, reason: i.rating_reason! } : null,
      reported: i.reported,
      // Explicit projection: never return the answer or evidence before submission.
      ...(i.selected_index === null ? {} : { result: {
        selectedIndex: i.selected_index, correctAnswerIndex: i.correct_answer_index,
        correct: i.selected_index === i.correct_answer_index, explanation: i.explanation, sources: i.sources,
      } }),
    })),
  };
}

export class PostgresPlayRepository implements PlayRepository {
  constructor(private pool: Pool) {}
  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }
  async start(userId: string, input: StartPlay) {
    return this.transaction(async client => {
      // Serialize one user's starts so concurrent requests don't choose the same unseen questions.
      await client.query('SELECT pg_advisory_xact_lock(187302, hashtext($1))', [userId]);
      const existing = await client.query('SELECT user_id FROM quizquiz.play_sessions WHERE id=$1', [input.requestId]);
      if (existing.rowCount) {
        if (existing.rows[0].user_id !== userId) throw missing();
        return readSession(client, userId, input.requestId);
      }
      const bank = await client.query<BankRow>(`
        SELECT b.*,
          COALESCE(r.positives, 0)::int AS positives, COALESCE(r.ratings, 0)::int AS ratings,
          seen.last_seen AS "lastSeen"
        FROM quizquiz.bank_questions b
        LEFT JOIN (SELECT question_id, count(*) AS ratings, count(*) FILTER (WHERE value=1) AS positives
          FROM quizquiz.question_ratings GROUP BY question_id) r ON r.question_id=b.id
        LEFT JOIN (SELECT i.question_id, max(s.created_at) AS last_seen FROM quizquiz.play_items i
          JOIN quizquiz.play_sessions s ON s.id=i.session_id WHERE s.user_id=$1 GROUP BY i.question_id) seen ON seen.question_id=b.id
        WHERE b.status='published' AND ($2='all' OR b.category=$2) AND ($3='all' OR b.difficulty=$3)
        ORDER BY b.id
        FOR SHARE OF b
      `, [userId, input.category, input.difficulty]);
      const picked = selectQuestions(bank.rows, input.count, random);
      if (!picked.length) throw new PlayError('EMPTY_BANK', '이 조건의 문제가 아직 없어요. 주제나 난이도를 전체로 바꿔보세요.', 409);
      await client.query('INSERT INTO quizquiz.play_sessions(id,user_id,category,difficulty) VALUES($1,$2,$3,$4)', [input.requestId, userId, input.category, input.difficulty]);
      for (const [position, q] of picked.entries()) {
        const shuffled = shuffleOptions(q.options, q.correct_answer_index, random);
        await client.query(`INSERT INTO quizquiz.play_items(session_id,position,question_id,question,options,correct_answer_index,explanation,sources,is_review)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [input.requestId, position, q.id, q.question, shuffled.options, shuffled.correctAnswerIndex, q.explanation, JSON.stringify(q.sources), !!q.lastSeen]);
      }
      return readSession(client, userId, input.requestId);
    });
  }
  async get(userId: string, id: string) { return readSession(this.pool, userId, id); }
  async answer(userId: string, id: string, position: number, answerIndex: number) {
    return this.transaction(async client => {
      const session = await client.query('SELECT id FROM quizquiz.play_sessions WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId]);
      if (!session.rowCount) throw missing();
      const result = await client.query('SELECT position, selected_index FROM quizquiz.play_items WHERE session_id=$1 ORDER BY position', [id]);
      const item = result.rows.find(i => i.position === position);
      if (!item) throw missing();
      if (item.selected_index !== null) {
        if (item.selected_index !== answerIndex) throw new PlayError('ALREADY_ANSWERED', '제출한 답은 바꿀 수 없어요.', 409);
        return readSession(client, userId, id);
      }
      if (result.rows.find(i => i.selected_index === null)?.position !== position) throw new PlayError('OUT_OF_ORDER', '현재 문제부터 풀어주세요.', 409);
      await client.query('UPDATE quizquiz.play_items SET selected_index=$3, answered_at=now() WHERE session_id=$1 AND position=$2', [id, position, answerIndex]);
      await client.query(`UPDATE quizquiz.play_sessions SET completed_at=now() WHERE id=$1
        AND NOT EXISTS(SELECT 1 FROM quizquiz.play_items WHERE session_id=$1 AND selected_index IS NULL)`, [id]);
      return readSession(client, userId, id);
    });
  }
  private async lockAnswered(client: PoolClient, userId: string, questionId: string) {
    const question = await client.query('SELECT id FROM quizquiz.bank_questions WHERE id=$1 FOR UPDATE', [questionId]);
    if (!question.rowCount) throw missing();
    const played = await client.query(`SELECT 1 FROM quizquiz.play_items i JOIN quizquiz.play_sessions s ON s.id=i.session_id
      WHERE s.user_id=$1 AND i.question_id=$2 AND i.answered_at IS NOT NULL LIMIT 1`, [userId, questionId]);
    if (!played.rowCount) throw new PlayError('ANSWER_REQUIRED', '직접 답을 제출한 문제만 평가하거나 신고할 수 있어요.', 403);
  }
  async rate(userId: string, questionId: string, rating: Rating) {
    await this.transaction(async client => {
      await this.lockAnswered(client, userId, questionId);
      await client.query(`INSERT INTO quizquiz.question_ratings(question_id,user_id,value,reason) VALUES($1,$2,$3,$4)
        ON CONFLICT(question_id,user_id) DO UPDATE SET value=EXCLUDED.value, reason=EXCLUDED.reason, updated_at=now()`,
      [questionId, userId, rating.value, rating.value === -1 ? rating.reason : null]);
    });
  }
  async report(userId: string, questionId: string, reason: ReportReason) {
    await this.transaction(async client => {
      await this.lockAnswered(client, userId, questionId);
      await client.query(`INSERT INTO quizquiz.question_reports(question_id,user_id,reason) VALUES($1,$2,$3)
        ON CONFLICT(question_id,user_id) DO NOTHING`, [questionId, userId, reason]);
      // Distinct accounts, not request count. Serialize by question to avoid lost threshold checks.
      await client.query(`UPDATE quizquiz.bank_questions SET status='paused' WHERE id=$1 AND status='published'
        AND (SELECT count(*) FROM quizquiz.question_reports WHERE question_id=$1 AND status='open') >= 3`, [questionId]);
    });
  }
  async history(userId: string): Promise<PlayHistory[]> {
    const result = await this.pool.query(`SELECT s.id, s.created_at, count(*)::int AS count,
      count(i.answered_at)::int AS answered, count(*) FILTER(WHERE i.selected_index=i.correct_answer_index)::int AS score
      FROM quizquiz.play_sessions s JOIN quizquiz.play_items i ON i.session_id=s.id
      WHERE s.user_id=$1 GROUP BY s.id ORDER BY s.created_at DESC LIMIT 30`, [userId]);
    return result.rows.map(r => ({ id: r.id, createdAt: r.created_at.toISOString(), count: r.count, answered: r.answered, score: r.score }));
  }
}
export const getPlayRepository = (): PlayRepository => new PostgresPlayRepository(getDatabasePool());

export async function consumePlayQuota(userId: string, action: 'start' | 'feedback' | 'answer', pool = getDatabasePool()) {
  const limit = action === 'start' ? 10 : 60;
  const result = await pool.query(`INSERT INTO quizquiz.play_limits(user_id,action,count) VALUES($1,$2,1)
    ON CONFLICT(user_id,action) DO UPDATE SET
      started_at=CASE WHEN play_limits.started_at <= now()-interval '1 minute' THEN now() ELSE play_limits.started_at END,
      count=CASE WHEN play_limits.started_at <= now()-interval '1 minute' THEN 1 ELSE play_limits.count+1 END
    WHERE play_limits.started_at <= now()-interval '1 minute' OR play_limits.count < $3 RETURNING count`, [userId, action, limit]);
  return result.rowCount === 1;
}
