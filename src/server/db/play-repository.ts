import 'server-only';
import { randomInt } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PlayRepository } from '@/features/play/ports/play-repository';
import { PlayError, type PlaySession, type PlayHistory, type Rating, type ReportReason, type Source, type StartPlay } from '@/features/play/domain/play';
import { selectQuestions, shuffleOptions, type Candidate } from '@/features/play/domain/selection';
import { getDatabasePool } from './pool';
import { latestAnswers, collectionMembership, readCollection, readDashboard } from './learning-queries';

type BankRow = Candidate & { question: string; options: string[]; correct_answer_index: number; explanation: string; sources: Source[] };
type ItemRow = {
  question_id: string; position: number; question: string; options: string[]; is_review: boolean;
  selected_index: number | null; correct_answer_index: number; explanation: string; sources: Source[];
  rating_value: number | null; rating_reason: 'obvious' | 'ambiguous' | 'options' | null; reported: boolean; bookmarked: boolean;
};
type Queryable = Pick<Pool, 'query'>;
const random = () => randomInt(0, 1_000_000) / 1_000_000;
const missing = () => new PlayError('NOT_FOUND', '문제 기록을 찾을 수 없어요.', 404);

async function readSession(db: Queryable, userId: string, id: string): Promise<PlaySession> {
  const session = await db.query(`SELECT s.id, s.category, s.difficulty, s.completed_at, s.mode, s.source, s.daily_day::text,
    (SELECT count(*)::int FROM quizquiz.play_items WHERE session_id=s.id AND selected_index IS NOT NULL) AS answered,
    (SELECT count(*)::int FROM quizquiz.play_items WHERE session_id=s.id AND selected_index=correct_answer_index) AS score
    FROM quizquiz.play_sessions s WHERE s.id=$1 AND s.user_id=$2`, [id, userId]);
  if (!session.rowCount) throw missing();
  const state = session.rows[0];
  const endless = state.mode === 'endless';
  const items = await db.query<ItemRow>(`
    SELECT i.*, r.value AS rating_value, r.reason AS rating_reason,
      EXISTS(SELECT 1 FROM quizquiz.question_bookmarks m WHERE m.question_id=i.question_id AND m.user_id=$2) AS bookmarked,
      EXISTS(SELECT 1 FROM quizquiz.question_reports p WHERE p.question_id=i.question_id AND p.user_id=$2) AS reported
    FROM quizquiz.play_items i
    LEFT JOIN quizquiz.question_ratings r ON r.question_id=i.question_id AND r.user_id=$2
    WHERE i.session_id=$1 AND (NOT $3 OR NOT $4 OR i.selected_index IS NOT NULL)
    ORDER BY i.position DESC LIMIT $5
  `, [id, userId, endless, !!state.completed_at, endless ? 20 : 10]);
  return {
    id, category: session.rows[0].category, difficulty: session.rows[0].difficulty,
    completed: !!state.completed_at, mode: state.mode, answeredCount: state.answered,
    score: state.score, source: state.source, dailyDay: state.daily_day,
    questions: items.rows.reverse().map(i => ({
      id: i.question_id, position: i.position, question: i.question, options: i.options, isReview: i.is_review,
      rating: i.rating_value === 1 ? { value: 1 } : i.rating_value === -1 ? { value: -1, reason: i.rating_reason! } : null,
      reported: i.reported, bookmarked: i.bookmarked,
      // Explicit projection: never return the answer or evidence before submission.
      ...(i.selected_index === null ? {} : { result: {
        selectedIndex: i.selected_index, correctAnswerIndex: i.correct_answer_index,
        correct: i.selected_index === i.correct_answer_index, explanation: i.explanation, sources: i.sources,
      } }),
    })),
  };
}

async function candidates(db: Queryable, userId: string, category: string, difficulty: string) {
  return db.query<BankRow>(`
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
      `, [userId, category, difficulty]);
}

async function appendQuestion(db: Queryable, id: string, position: number, q: BankRow) {
  const shuffled = shuffleOptions(q.options, q.correct_answer_index, random);
  await db.query(`INSERT INTO quizquiz.play_items(session_id,position,question_id,question,options,correct_answer_index,explanation,sources,is_review,category)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [id, position, q.id, q.question, shuffled.options, shuffled.correctAnswerIndex, q.explanation, JSON.stringify(q.sources), !!q.lastSeen, q.category]);
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
      const existing = await client.query('SELECT user_id FROM quizquiz.play_sessions WHERE id=$1 FOR SHARE', [input.requestId]);
      if (existing.rowCount) {
        if (existing.rows[0].user_id !== userId) throw missing();
        return readSession(client, userId, input.requestId);
      }
      const source = input.source ?? 'standard';
      if (source !== 'standard' && input.mode === 'endless') throw new PlayError('INVALID_MODE', '복습과 오늘의 문제는 일반 모드로 풀어요.');
      if (source === 'daily') return this.startDaily(client, userId, input.requestId);
      const bank = await candidates(client, userId, input.category, input.difficulty);
      let eligible = bank.rows;
      if (source === 'wrong' || source === 'bookmarks') {
        const ids = await client.query(`WITH latest AS (${latestAnswers}) SELECT b.id FROM quizquiz.bank_questions b WHERE ${collectionMembership}`, [userId, source]);
        const allowed = new Set(ids.rows.map(r => r.id));
        eligible = eligible.filter(q => allowed.has(q.id) && (!input.questionId || q.id === input.questionId));
      }
      const picked = selectQuestions(eligible, input.questionId ? 1 : input.mode === 'endless' ? 1 : input.count, random);
      if (!picked.length) throw new PlayError('EMPTY_BANK', source === 'wrong' ? '지금 복습할 오답이 없어요. 다시 맞힌 문제는 목록에서 빠져요.' : source === 'bookmarks' ? '지금 풀 수 있는 북마크 문제가 없어요.' : '이 조건의 문제가 아직 없어요. 주제나 난이도를 전체로 바꿔보세요.', 409);
      await client.query('INSERT INTO quizquiz.play_sessions(id,user_id,category,difficulty,mode,source) VALUES($1,$2,$3,$4,$5,$6)', [input.requestId, userId, input.category, input.difficulty, input.mode ?? 'standard', source]);
      for (const [position, q] of picked.entries()) await appendQuestion(client, input.requestId, position, q);
      return readSession(client, userId, input.requestId);
    });
  }
  private async startDaily(client: PoolClient, userId: string, requestId: string) {
    const day: string = (await client.query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date::text AS day")).rows[0].day;
    const existing = await client.query('SELECT id FROM quizquiz.play_sessions WHERE user_id=$1 AND daily_day=$2', [userId, day]);
    if (existing.rowCount) return readSession(client, userId, existing.rows[0].id);
    // Serialize creation across users and app instances; the whole set commits atomically.
    await client.query('SELECT pg_advisory_xact_lock(187303, hashtext($1))', [day]);
    const set = await client.query('SELECT day FROM quizquiz.daily_sets WHERE day=$1', [day]);
    if (!set.rowCount) {
      const bank = await candidates(client, '', 'all', 'all');
      const picked = selectQuestions(bank.rows, 5, random);
      if (picked.length !== 5) throw new PlayError('EMPTY_DAILY', '오늘의 5문제를 준비 중이에요. 잠시 후 다시 와주세요.', 409);
      await client.query('INSERT INTO quizquiz.daily_sets(day) VALUES($1)', [day]);
      for (const [position, q] of picked.entries()) await client.query(`INSERT INTO quizquiz.daily_items
        (day,position,question_id,category,difficulty,question,options,correct_answer_index,explanation,sources)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [day, position, q.id, q.category, q.difficulty, q.question, q.options, q.correct_answer_index, q.explanation, JSON.stringify(q.sources)]);
    }
    const items = await client.query<BankRow>(`SELECT d.*, d.question_id AS id, NULL AS "lastSeen"
      FROM quizquiz.daily_items d JOIN quizquiz.bank_questions b ON b.id=d.question_id
      WHERE d.day=$1 AND b.status='published' ORDER BY d.position FOR SHARE OF b`, [day]);
    if (items.rows.length !== 5) throw new PlayError('EMPTY_DAILY', '오늘의 문제를 다시 검토 중이에요. 다른 모드로 먼저 풀어주세요.', 409);
    await client.query(`INSERT INTO quizquiz.play_sessions(id,user_id,category,difficulty,mode,source,daily_day)
      VALUES($1,$2,'all','all','standard','daily',$3)`, [requestId, userId, day]);
    for (const [position, q] of items.rows.entries()) await appendQuestion(client, requestId, position, q);
    return readSession(client, userId, requestId);
  }
  async bookmark(userId: string, questionId: string, saved: boolean) {
    await this.transaction(async client => {
      if (saved) {
        await this.lockAnswered(client, userId, questionId);
        await client.query('INSERT INTO quizquiz.question_bookmarks(user_id,question_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [userId, questionId]);
      } else {
        await client.query('DELETE FROM quizquiz.question_bookmarks WHERE user_id=$1 AND question_id=$2', [userId, questionId]);
      }
    });
  }
  dashboard(userId: string) { return readDashboard(this.pool, userId); }
  collection(userId: string, source: 'wrong' | 'bookmarks', page: number) { return readCollection(this.pool, userId, source, page); }
  async get(userId: string, id: string) {
    return this.transaction(async client => {
      await client.query('SELECT id FROM quizquiz.play_sessions WHERE id=$1 AND user_id=$2 FOR SHARE', [id, userId]);
      return readSession(client, userId, id);
    });
  }
  async answer(userId: string, id: string, position: number, answerIndex: number) {
    return this.transaction(async client => {
      const session = await client.query('SELECT id, mode, completed_at FROM quizquiz.play_sessions WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId]);
      if (!session.rowCount) throw missing();
      const result = await client.query('SELECT position, selected_index FROM quizquiz.play_items WHERE session_id=$1 AND (position=$2 OR selected_index IS NULL) ORDER BY position', [id, position]);
      const item = result.rows.find(i => i.position === position);
      if (!item) throw missing();
      if (item.selected_index !== null) {
        if (item.selected_index !== answerIndex) throw new PlayError('ALREADY_ANSWERED', '제출한 답은 바꿀 수 없어요.', 409);
        return readSession(client, userId, id);
      }
      if (session.rows[0].completed_at) throw new PlayError('FINISHED', '이미 종료한 풀이예요.', 409);
      if (result.rows.find(i => i.selected_index === null)?.position !== position) throw new PlayError('OUT_OF_ORDER', '현재 문제부터 풀어주세요.', 409);
      await client.query('UPDATE quizquiz.play_items SET selected_index=$3, answered_at=clock_timestamp() WHERE session_id=$1 AND position=$2', [id, position, answerIndex]);
      await client.query(`UPDATE quizquiz.play_sessions SET completed_at=now() WHERE id=$1 AND mode='standard'
        AND NOT EXISTS(SELECT 1 FROM quizquiz.play_items WHERE session_id=$1 AND selected_index IS NULL)`, [id]);
      return readSession(client, userId, id);
    });
  }
  async next(userId: string, id: string, position: number) {
    return this.transaction(async client => {
      // Same order as start: serialize selection for one user before locking the session.
      await client.query('SELECT pg_advisory_xact_lock(187302, hashtext($1))', [userId]);
      const session = await client.query('SELECT * FROM quizquiz.play_sessions WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId]);
      if (!session.rowCount) throw missing();
      const state = session.rows[0];
      if (state.mode !== 'endless') throw new PlayError('INVALID_MODE', '무한모드에서만 다음 문제를 받을 수 있어요.', 409);
      if (state.completed_at) return readSession(client, userId, id);
      const last = (await client.query('SELECT position, question_id, selected_index FROM quizquiz.play_items WHERE session_id=$1 ORDER BY position DESC LIMIT 1', [id])).rows[0];
      // Retry after a lost response, or a second tab, must not append another question.
      if (position < last.position) return readSession(client, userId, id);
      if (position !== last.position || last.selected_index === null) throw new PlayError('ANSWER_REQUIRED', '현재 문제에 먼저 답해주세요.', 409);
      const bank = await candidates(client, userId, state.category, state.difficulty);
      if (!bank.rowCount) throw new PlayError('EMPTY_BANK', '지금 출제할 문제가 없어요. 잠시 후 다시 시도하거나 여기까지 마쳐주세요.', 409);
      const exposures = (await client.query('SELECT question_id, count(*)::int count FROM quizquiz.play_items WHERE session_id=$1 GROUP BY question_id', [id])).rows;
      const counts = new Map(exposures.map(q => [q.question_id, q.count as number]));
      const min = Math.min(...bank.rows.map(q => counts.get(q.id) ?? 0));
      const cycle = bank.rows.filter(q => (counts.get(q.id) ?? 0) === min);
      const withoutLast = cycle.filter(q => q.id !== last.question_id);
      const [picked] = selectQuestions(withoutLast.length ? withoutLast : cycle, 1, random);
      await appendQuestion(client, id, last.position + 1, picked);
      return readSession(client, userId, id);
    });
  }
  async finish(userId: string, id: string) {
    return this.transaction(async client => {
      const session = await client.query('SELECT mode FROM quizquiz.play_sessions WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId]);
      if (!session.rowCount) throw missing();
      if (session.rows[0].mode !== 'endless') throw new PlayError('INVALID_MODE', '무한모드에서만 여기까지 마칠 수 있어요.', 409);
      await client.query('UPDATE quizquiz.play_sessions SET completed_at=COALESCE(completed_at,now()) WHERE id=$1', [id]);
      return readSession(client, userId, id);
    });
  }
  private async lockAnswered(client: PoolClient, userId: string, questionId: string) {
    const question = await client.query('SELECT id FROM quizquiz.bank_questions WHERE id=$1 FOR UPDATE', [questionId]);
    if (!question.rowCount) throw missing();
    const played = await client.query(`SELECT 1 FROM quizquiz.play_items i JOIN quizquiz.play_sessions s ON s.id=i.session_id
      WHERE s.user_id=$1 AND i.question_id=$2 AND i.answered_at IS NOT NULL LIMIT 1`, [userId, questionId]);
    if (!played.rowCount) throw new PlayError('ANSWER_REQUIRED', '직접 답을 제출한 문제만 저장하거나 평가·신고할 수 있어요.', 403);
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
    const result = await this.pool.query(`SELECT s.id, s.created_at, s.mode, s.source, s.daily_day::text, s.completed_at, count(*)::int AS count,
      count(i.answered_at)::int AS answered, count(*) FILTER(WHERE i.selected_index=i.correct_answer_index)::int AS score
      FROM quizquiz.play_sessions s JOIN quizquiz.play_items i ON i.session_id=s.id
      WHERE s.user_id=$1 GROUP BY s.id ORDER BY s.created_at DESC LIMIT 30`, [userId]);
    return result.rows.map(r => ({ id: r.id, createdAt: r.created_at.toISOString(), count: r.count, answered: r.answered, score: r.score, mode: r.mode, completed: !!r.completed_at, source: r.source, dailyDay: r.daily_day }));
  }
}
export const getPlayRepository = (): PlayRepository => new PostgresPlayRepository(getDatabasePool());

export async function consumePlayQuota(userId: string, action: 'start' | 'feedback' | 'answer' | 'next', pool = getDatabasePool()) {
  const limit = action === 'start' ? 10 : 60;
  const result = await pool.query(`INSERT INTO quizquiz.play_limits(user_id,action,count) VALUES($1,$2,1)
    ON CONFLICT(user_id,action) DO UPDATE SET
      started_at=CASE WHEN play_limits.started_at <= now()-interval '1 minute' THEN now() ELSE play_limits.started_at END,
      count=CASE WHEN play_limits.started_at <= now()-interval '1 minute' THEN 1 ELSE play_limits.count+1 END
    WHERE play_limits.started_at <= now()-interval '1 minute' OR play_limits.count < $3 RETURNING count`, [userId, action, limit]);
  return result.rowCount === 1;
}
