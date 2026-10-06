import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import pg from 'pg';
import { z } from 'zod';

// Operator-only CLI. Importing AI output never publishes it.
const source = z.object({ title: z.string().trim().min(1).max(200), url: z.url().refine(url => new URL(url).protocol === 'https:', 'Use HTTPS sources') }).strict();
const question = z.object({
  id: z.uuid().optional(), category: z.enum(['general','science','history','geography','culture']),
  difficulty: z.enum(['easy','medium','hard']), question: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1).max(200)).length(4).refine(options => new Set(options.map(o => o.replace(/\s+/g, ' ').toLowerCase())).size === 4),
  correctAnswerIndex: z.number().int().min(0).max(3), explanation: z.string().trim().min(1).max(1000),
  sources: z.array(source).max(10).default([]),
  provenance: z.object({ provider: z.string().max(100), model: z.string().max(100).optional(), promptVersion: z.string().max(100).optional() }).default({ provider: 'manual-import' }),
}).strict();
const [action, target, reviewer, note] = process.argv.slice(2);
if (!['import','queue','publish','pause','retire','export'].includes(action) || !process.env.DATABASE_URL) {
  console.error('DATABASE_URL required. Usage: npm run bank -- import file.json | queue | publish|pause|retire UUID reviewer "review note" | export file.json');
  process.exit(1);
}
let imported;
if (action === 'import') {
  const parsed = z.array(question).min(1).max(1000).safeParse(JSON.parse(await readFile(target, 'utf8')));
  if (!parsed.success) { console.error('Invalid import: question/options/answer/sources fields must match the documented schema.'); process.exit(1); }
  imported = parsed.data;
}
if (['publish','pause','retire'].includes(action) && (!z.uuid().safeParse(target).success || !reviewer?.trim() || !note?.trim() || reviewer.length > 100 || note.length > 1000)) {
  console.error('A question UUID, reviewer name and review note (max 1000 characters) are required.'); process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
try {
  await client.connect(); await client.query('BEGIN');
  if (action === 'import') {
    for (const q of imported) {
      const id = q.id ?? randomUUID();
      const existing = await client.query('SELECT status FROM quizquiz.bank_questions WHERE id=$1 FOR UPDATE', [id]);
      if (existing.rowCount && existing.rows[0].status !== 'draft') throw new Error('Only drafts may be edited. Retire the old question and import a new ID for content corrections.');
      await client.query(`INSERT INTO quizquiz.bank_questions(id,category,difficulty,question,options,correct_answer_index,explanation,sources,provenance)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET category=EXCLUDED.category,difficulty=EXCLUDED.difficulty,
        question=EXCLUDED.question,options=EXCLUDED.options,correct_answer_index=EXCLUDED.correct_answer_index,
        explanation=EXCLUDED.explanation,sources=EXCLUDED.sources,provenance=EXCLUDED.provenance`,
      [id,q.category,q.difficulty,q.question,q.options,q.correctAnswerIndex,q.explanation,JSON.stringify(q.sources),JSON.stringify(q.provenance)]);
      console.log(`Draft: ${id}`);
    }
  } else if (action === 'queue') {
    const rows = await client.query(`SELECT b.id,b.question,b.status,b.sources,b.review_note,
      (SELECT count(*)::int FROM quizquiz.question_reports r WHERE r.question_id=b.id AND r.status='open') AS open_reports,
      (SELECT jsonb_agg(jsonb_build_object('reason',r.reason,'createdAt',r.created_at)) FROM quizquiz.question_reports r WHERE r.question_id=b.id AND r.status='open') AS reports
      FROM quizquiz.bank_questions b WHERE b.status IN ('draft','paused') OR EXISTS(SELECT 1 FROM quizquiz.question_reports r WHERE r.question_id=b.id AND r.status='open')
      ORDER BY b.created_at LIMIT 200`);
    console.log(JSON.stringify(rows.rows, null, 2));
  } else if (action === 'export') {
    const rows = await client.query(`SELECT id,category,difficulty,question,options,correct_answer_index AS "correctAnswerIndex",explanation,sources,
      jsonb_strip_nulls(jsonb_build_object('provider',COALESCE(provenance->>'provider','unknown'),'model',provenance->>'model','promptVersion',provenance->>'promptVersion')) AS provenance
      FROM quizquiz.bank_questions ORDER BY id`);
    // An export is re-imported as drafts so publication cannot happen accidentally.
    await writeFile(target, JSON.stringify(rows.rows, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(`Exported ${rows.rowCount} questions; keep answer keys private.`);
  } else {
    const selected = await client.query('SELECT * FROM quizquiz.bank_questions WHERE id=$1 FOR UPDATE', [target]);
    const row = selected.rows[0];
    if (!row) throw new Error('Question not found.');
    if (row.status === 'retired' && action !== 'retire') throw new Error('Retired content is immutable; create a new revision.');
    if (action === 'publish') {
      z.array(source).min(1).parse(row.sources);
      await client.query("UPDATE quizquiz.question_reports SET status='resolved' WHERE question_id=$1", [target]);
    }
    const status = { publish: 'published', pause: 'paused', retire: 'retired' }[action];
    await client.query('UPDATE quizquiz.bank_questions SET status=$2, reviewed_at=now(), review_note=$3 WHERE id=$1', [target,status,`${reviewer}: ${note}`]);
    console.log(`${target}: ${status}`);
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  // Avoid printing connection details or SQL values from database errors.
  console.error(error.code ? `Bank operation failed (${error.code}). No changes committed.` : 'Bank operation failed. Check the file, question status, HTTPS sources and review arguments.');
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
