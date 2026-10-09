import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { isDeepStrictEqual } from 'node:util';
import { SubmissionSchema, SubmissionError, type SubmissionInput, type SubmissionSummary } from '../../features/submissions/domain/submission.ts';
import type { SubmissionRepository } from '../../features/submissions/ports/submission-repository.ts';
import { getSubcategory } from '../../features/quiz/domain/taxonomy.ts';

type Row = { id: string; input: SubmissionInput; status: SubmissionSummary['status']; created_at: Date; review_note: string | null };
const summary = (r: Row): SubmissionSummary => ({ id: r.id, question: r.input.question, subcategory: r.input.subcategory, difficulty: r.input.difficulty, status: r.status, createdAt: r.created_at.toISOString(), reviewNote: r.review_note });
export class PostgresSubmissionRepository implements SubmissionRepository {
  private pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }
  async history(userId: string) {
    const result = await this.pool.query<Row>('SELECT id,input,status,created_at,review_note FROM quizquiz.question_submissions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30', [userId]);
    return result.rows.map(summary);
  }
  async submit(userId: string, value: SubmissionInput) {
    const parsed = SubmissionSchema.safeParse(value);
    if (!parsed.success) throw new SubmissionError('INVALID_INPUT', '문제와 보기, 해설, 출처를 확인해 주세요.');
    const input = parsed.data;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('submission:' || $1, 0))", [userId]);
      const existing = (await client.query<Row>('SELECT * FROM quizquiz.question_submissions WHERE user_id=$1 AND request_id=$2', [userId, input.requestId])).rows[0];
      if (existing) {
        if (!isDeepStrictEqual(existing.input, input)) throw new SubmissionError('REQUEST_CONFLICT', '제출한 요청과 내용이 달라요. 새로 제출해 주세요.', 409);
        await client.query('COMMIT'); return summary(existing);
      }
      const count = await client.query<{ n: number }>("SELECT count(*)::int n FROM quizquiz.question_submissions WHERE user_id=$1 AND created_at>now()-interval '24 hours'", [userId]);
      if (count.rows[0].n >= 5) throw new SubmissionError('DAILY_LIMIT', '최근 24시간 동안 최대 5개를 제출할 수 있어요. 나중에 다시 와 주세요.', 429);
      const duplicate = await client.query("SELECT id FROM quizquiz.question_submissions WHERE user_id=$1 AND status IN ('pending','approved') AND lower(regexp_replace(trim(input->>'question'), '\\s+', ' ', 'g'))=lower(regexp_replace(trim($2), '\\s+', ' ', 'g')) LIMIT 1", [userId, input.question]);
      if (duplicate.rowCount) throw new SubmissionError('DUPLICATE', '이미 제출한 문제예요. 내 제출 기록을 확인해 주세요.', 409);
      const result = await client.query<Row>('INSERT INTO quizquiz.question_submissions(id,user_id,request_id,input) VALUES($1,$2,$3,$4) RETURNING *', [randomUUID(), userId, input.requestId, JSON.stringify(input)]);
      await client.query('COMMIT'); return summary(result.rows[0]);
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  /** Operator CLI only. Never expose this method through the public API. */
  async review(id: string, decision: 'approve' | 'reject', reviewer: string, note: string) {
    if (!reviewer.trim() || reviewer.length > 100 || !note.trim() || note.length > 1000) throw new SubmissionError('INVALID_REVIEW', '검수자와 검수 사유를 입력해 주세요.');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const row = (await client.query<Row>('SELECT * FROM quizquiz.question_submissions WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!row || row.status !== 'pending') throw new SubmissionError('NOT_PENDING', '검토 대기 중인 제출만 처리할 수 있어요.', 409);
      let bankId: string | null = null;
      if (decision === 'approve') {
        const input = SubmissionSchema.parse(row.input); const sub = getSubcategory(input.subcategory); bankId = randomUUID();
        await client.query(`INSERT INTO quizquiz.bank_questions(id,category,difficulty,question,options,correct_answer_index,explanation,sources,status,provenance,review_note,reviewed_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,'published',$9,$10,now())`, [bankId,sub.category,input.difficulty,input.question,input.options,input.correctAnswerIndex,input.explanation,JSON.stringify([{title:input.sourceTitle,url:input.sourceUrl}]),JSON.stringify({provider:'community',submissionId:id,taxonomy:{version:'v1',subcategoryId:sub.id,major:sub.major,minor:sub.minor,tags:[]},editorialReview:{reviewer,note}}),`${reviewer}: ${note}`]);
      }
      await client.query('UPDATE quizquiz.question_submissions SET status=$2,bank_question_id=$3,reviewed_at=now(),reviewer=$4,review_note=$5 WHERE id=$1', [id,decision === 'approve' ? 'approved' : 'rejected',bankId,reviewer,note]);
      await client.query('COMMIT'); return { id, status: decision === 'approve' ? 'approved' : 'rejected', bankId };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}
