import 'server-only';
import type { Pool } from 'pg';
import { QuestionImageSchema } from '@/features/play/domain/question-image';
import type { LearningCollection, LearningDashboard } from '@/features/play/domain/play';

type Queryable = Pick<Pool, 'query'>;
// Last submitted answer wins, even when the same question appears in several sessions.
export const latestAnswers = `SELECT DISTINCT ON (i.question_id) i.question_id,
  i.selected_index=i.correct_answer_index AS correct, i.answered_at
  FROM quizquiz.play_items i JOIN quizquiz.play_sessions s ON s.id=i.session_id
  WHERE s.user_id=$1 AND i.answered_at IS NOT NULL
  ORDER BY i.question_id, i.answered_at DESC, i.session_id DESC, i.position DESC`;
export const collectionMembership = `(CASE WHEN $2='wrong' THEN EXISTS (
  SELECT 1 FROM latest a WHERE a.question_id=b.id AND NOT a.correct)
  ELSE EXISTS (SELECT 1 FROM quizquiz.question_bookmarks m WHERE m.user_id=$1 AND m.question_id=b.id) END)`;

export async function readCollection(db: Queryable, userId: string, source: 'wrong' | 'bookmarks', page: number): Promise<LearningCollection> {
  const result = await db.query(`WITH latest AS (${latestAnswers}), collection AS (
    SELECT b.id, b.question, b.category, b.difficulty, b.image, b.status='published' AS available
    FROM quizquiz.bank_questions b WHERE ${collectionMembership}
  ) SELECT (SELECT count(*)::int FROM collection) AS total,
    COALESCE((SELECT jsonb_agg(row_to_json(p)) FROM (SELECT * FROM collection ORDER BY available DESC, id LIMIT 20 OFFSET $3) p),'[]') AS items`,
  [userId, source, (page - 1) * 20]);
  return { total: result.rows[0].total, page, items: (result.rows[0].items as LearningCollection['items']).map(q => ({ ...q, image: q.image ? QuestionImageSchema.parse(q.image) : null })) };
}

export async function readDashboard(db: Queryable, userId: string): Promise<LearningDashboard> {
  // One SQL snapshot keeps counts, today's state and participation consistent.
  const result = await db.query(`WITH latest AS (${latestAnswers}), today AS (
    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date AS day
  ), daily AS (
    SELECT s.id, s.daily_day, s.completed_at IS NOT NULL AS completed,
      count(i.answered_at)::int AS answered,
      count(*) FILTER(WHERE i.selected_index=i.correct_answer_index)::int AS score
    FROM quizquiz.play_sessions s JOIN quizquiz.play_items i ON i.session_id=s.id
    WHERE s.user_id=$1 AND s.source='daily' GROUP BY s.id
  ) SELECT
    (SELECT day::text FROM today) AS day,
    COALESCE((SELECT jsonb_agg(row_to_json(c)) FROM (
      SELECT i.category, count(*)::int AS answered, count(*) FILTER(WHERE i.selected_index=i.correct_answer_index)::int AS correct
      FROM quizquiz.play_items i JOIN quizquiz.play_sessions s ON s.id=i.session_id
      WHERE s.user_id=$1 AND i.answered_at IS NOT NULL GROUP BY i.category ORDER BY i.category
    ) c),'[]') AS categories,
    (SELECT count(*)::int FROM latest a JOIN quizquiz.bank_questions b ON b.id=a.question_id WHERE NOT a.correct AND b.status='published') AS wrong_count,
    (SELECT count(*)::int FROM quizquiz.question_bookmarks m JOIN quizquiz.bank_questions b ON b.id=m.question_id WHERE m.user_id=$1 AND b.status='published') AS bookmark_count,
    (SELECT row_to_json(d) FROM daily d WHERE d.daily_day=(SELECT day FROM today)) AS daily,
    COALESCE((SELECT jsonb_agg(row_to_json(p)) FROM (
      SELECT daily_day::text AS day, completed, score FROM daily
      WHERE daily_day >= (SELECT day FROM today)-29 ORDER BY daily_day DESC
    ) p),'[]') AS participation`, [userId]);
  const r = result.rows[0];
  return { categories: r.categories, wrongCount: r.wrong_count, bookmarkCount: r.bookmark_count,
    daily: { day: r.day, sessionId: r.daily?.id ?? null, completed: r.daily?.completed ?? false, answered: r.daily?.answered ?? 0, score: r.daily?.score ?? 0 },
    participation: r.participation };
}
