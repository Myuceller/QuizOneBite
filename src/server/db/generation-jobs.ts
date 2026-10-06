import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { QuizGenerationInput } from '../../features/quiz/domain/quiz.ts';
import { BANK_PROMPT_VERSION, PRICING_VERSION, RESERVATION_MICROS, BankGenerationError, bankRequestHash, usageCharge, type Evidence, type BankGenerator } from '../ai/bank-generation.ts';

export type GenerationJob = {
  id: string; status: 'reserved' | 'completed' | 'failed'; questionIds: string[];
  chargedUsd: number; skipped: number; errorCode: string | null;
};
async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
export async function getGenerationJob(pool: Pool, id: string): Promise<GenerationJob | null> {
  const result = await pool.query('SELECT id,status,question_ids,charged_micros,skipped_count,error_code FROM quizquiz.generation_jobs WHERE id=$1', [id]);
  const row = result.rows[0];
  return row ? { id: row.id, status: row.status, questionIds: row.question_ids, chargedUsd: Number(row.charged_micros) / 1_000_000, skipped: row.skipped_count, errorCode: row.error_code } : null;
}
export async function generateBankDrafts(options: {
  pool: Pool; jobId: string; input: QuizGenerationInput; evidence: Evidence; model: string;
  monthlyMicros: number; generator: BankGenerator;
}): Promise<GenerationJob> {
  const { pool, jobId, input, evidence, model, monthlyMicros, generator } = options;
  const hash = bankRequestHash(input, evidence, model);
  const reserved = await transaction(pool, async client => {
    // All CLI processes sharing this DB reserve budget atomically, before any API call.
    await client.query('SELECT pg_advisory_xact_lock(187303, 1)');
    const previous = await client.query('SELECT request_hash FROM quizquiz.generation_jobs WHERE id=$1', [jobId]);
    if (previous.rowCount) {
      if (previous.rows[0].request_hash !== hash) throw new BankGenerationError('JOB_INPUT_CHANGED');
      return false;
    }
    const spent = await client.query(`SELECT COALESCE(sum(charged_micros),0) AS used FROM quizquiz.generation_jobs
      WHERE created_at >= date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`);
    if (Number(spent.rows[0].used) + RESERVATION_MICROS > monthlyMicros) throw new BankGenerationError('BUDGET_EXCEEDED');
    await client.query(`INSERT INTO quizquiz.generation_jobs(id,request_hash,request,model,prompt_version,pricing_version,reserved_micros,charged_micros)
      VALUES($1,$2,$3,$4,$5,$6,$7,$7)`, [jobId,hash,JSON.stringify({ input, evidence }),model,BANK_PROMPT_VERSION,PRICING_VERSION,RESERVATION_MICROS]);
    return true;
  });
  if (!reserved) return (await getGenerationJob(pool, jobId))!;
  // No transaction remains open during a network request. A crash retains the reservation.
  let result;
  try { result = await generator.generate(input); }
  catch (error) {
    const known = error instanceof BankGenerationError ? error : new BankGenerationError('AI_UNAVAILABLE');
    await pool.query(`UPDATE quizquiz.generation_jobs SET status='failed',charged_micros=$2,input_tokens=$3,output_tokens=$4,response_id=$5,error_code=$6,finished_at=now()
      WHERE id=$1 AND status='reserved'`, [jobId,usageCharge(known.usage),known.usage?.inputTokens ?? null,known.usage?.outputTokens ?? null,known.usage?.responseId ?? null,known.code]);
    return (await getGenerationJob(pool, jobId))!;
  }
  // Draft insertion and successful job completion are atomic. Exact text duplicates are skipped.
  // A storage failure leaves the reservation intact; the same job is never sent to AI twice.
  await transaction(pool, async client => {
    const ids: string[] = [];
    for (const [index, question] of result.quiz.questions.entries()) {
      const inserted = await client.query(`INSERT INTO quizquiz.bank_questions(id,category,difficulty,question,options,correct_answer_index,explanation,sources,provenance)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING id`, [randomUUID(),input.category,input.difficulty,question.question,question.options,question.correctAnswerIndex,question.explanation,
        JSON.stringify(result.sources[index]),JSON.stringify({ ...result.metadata, generationJobId: jobId })]);
      if (inserted.rowCount) ids.push(inserted.rows[0].id);
    }
    await client.query(`UPDATE quizquiz.generation_jobs SET status='completed',charged_micros=$2,input_tokens=$3,output_tokens=$4,response_id=$5,
      question_ids=$6,skipped_count=$7,finished_at=now() WHERE id=$1 AND status='reserved'`,
    [jobId,usageCharge(result.usage),result.usage.inputTokens,result.usage.outputTokens,result.usage.responseId,ids,result.quiz.questions.length-ids.length]);
  });
  return (await getGenerationJob(pool, jobId))!;
}
