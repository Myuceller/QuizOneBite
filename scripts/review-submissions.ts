import pg from 'pg';
import { z } from 'zod';
import { PostgresSubmissionRepository } from '../src/server/db/submission-repository.ts';
const [action,id,reviewer,note] = process.argv.slice(2);
let pool: pg.Pool | undefined;
try {
  if (!['queue','show','approve','reject'].includes(action) || !process.env.DATABASE_URL) throw new Error('USAGE');
  if (action !== 'queue') z.uuid().parse(id);
  pool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:5000,statement_timeout:15000});
  if (action === 'queue') console.log(JSON.stringify((await pool.query("SELECT id,input->>'question' question,input->>'subcategory' subcategory,created_at FROM quizquiz.question_submissions WHERE status='pending' ORDER BY created_at LIMIT 100")).rows,null,2));
  else if (action === 'show') console.log(JSON.stringify((await pool.query('SELECT id,input,status,review_note FROM quizquiz.question_submissions WHERE id=$1',[id])).rows,null,2));
  else {
    if (!reviewer || !note) throw new Error('REVIEW_REQUIRED');
    console.log(JSON.stringify(await new PostgresSubmissionRepository(pool).review(id,action as 'approve'|'reject',reviewer,note)));
  }
} catch (error) {
  console.error('Review failed. Usage: npm run submissions -- queue | show UUID | approve|reject UUID reviewer "review note". Approve only after checking sources, answer and general-knowledge quality.');
  if (error && typeof error === 'object' && 'code' in error) console.error(String(error.code));
  process.exitCode = 1;
} finally { await pool?.end(); }
