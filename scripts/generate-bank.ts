import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { z } from 'zod';
import { QuizGenerationInputSchema } from '../src/features/quiz/domain/quiz.ts';
import { EvidenceSchema, OpenAIBankGenerator, buildBankRequest, monthlyBudgetMicros, RESERVATION_MICROS, BankGenerationError } from '../src/server/ai/bank-generation.ts';
import { generateBankDrafts, getGenerationJob } from '../src/server/db/generation-jobs.ts';

let pool: pg.Pool | undefined;
try {
  const { values } = parseArgs({ options: {
    category: { type: 'string', default: 'science' }, difficulty: { type: 'string', default: 'medium' },
    count: { type: 'string', default: '3' }, evidence: { type: 'string', default: 'docs/examples/science-evidence.json' },
    job: { type: 'string' }, execute: { type: 'boolean', default: false }, status: { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('npm run bank:generate -- [--category science --difficulty medium --count 3 --evidence file.json] [--execute --job UUID] | --status UUID');
    console.log('Default: dry run, no AI call. Execution requires OPENAI_API_KEY, AI_MONTHLY_BUDGET_USD and DATABASE_URL.');
  } else if (values.status) {
    const id = z.uuid().parse(values.status);
    if (!process.env.DATABASE_URL) throw new BankGenerationError('DATABASE_URL_REQUIRED');
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
    console.log(JSON.stringify(await getGenerationJob(pool, id), null, 2));
  } else {
    const input = QuizGenerationInputSchema.parse({ category: values.category, difficulty: values.difficulty, count: Number(values.count) });
    const file = await readFile(values.evidence);
    if (file.byteLength > 24_000) throw new BankGenerationError('INPUT_TOO_LARGE');
    const evidence = EvidenceSchema.parse(JSON.parse(file.toString('utf8')));
    const model = process.env.OPENAI_MODEL ?? 'gpt-6-astra';
    buildBankRequest(input, evidence, [], model);
    const monthlyMicros = monthlyBudgetMicros(process.env.AI_MONTHLY_BUDGET_USD);
    const jobId = values.job ? z.uuid().parse(values.job) : randomUUID();
    const database = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
    console.log(JSON.stringify({ mode: values.execute ? 'execute' : 'dry-run', jobId, model, ...input, evidenceCount: evidence.length,
      database: database ? { host: database.hostname, name: database.pathname.slice(1) } : null,
      monthlyBudgetUsd: monthlyMicros / 1_000_000, reservationUsd: RESERVATION_MICROS / 1_000_000,
      note: '1 request, max 4000 output tokens, no retries; all questions remain drafts.' }, null, 2));
    if (values.execute) {
      if (!values.job) throw new BankGenerationError('EXPLICIT_JOB_ID_REQUIRED');
      if (!process.env.DATABASE_URL) throw new BankGenerationError('DATABASE_URL_REQUIRED');
      if (!process.env.OPENAI_API_KEY?.trim()) throw new BankGenerationError('API_KEY_REQUIRED');
      if (monthlyMicros < RESERVATION_MICROS) throw new BankGenerationError('BUDGET_EXCEEDED');
      pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
      const recent = await pool.query("SELECT question FROM quizquiz.bank_questions WHERE category=$1 AND status <> 'retired' ORDER BY created_at DESC LIMIT 10", [input.category]);
      // Bound the complete request before reserving funds or calling the provider.
      const avoid = recent.rows.map(row => row.question as string);
      buildBankRequest(input, evidence, avoid, model);
      const generator = new OpenAIBankGenerator(process.env.OPENAI_API_KEY, evidence, avoid, model);
      const job = await generateBankDrafts({ pool, jobId, input, evidence, model, monthlyMicros, generator });
      console.log(JSON.stringify(job, null, 2));
      if (job.status !== 'completed') process.exitCode = 1;
    }
  }
} catch (error) {
  const code = error instanceof BankGenerationError ? error.code : 'INVALID_INPUT_OR_STORAGE';
  console.error(`Generation stopped (${code}). Check settings or --status. Never retry an uncertain job with a new ID automatically.`);
  process.exitCode = 1;
} finally { await pool?.end(); }
