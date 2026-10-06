import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool, Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateQuiz, getQuizPreview } from "@/features/quiz/application/generate-quiz";
import { PostgresQuizRepository } from "@/server/db/quiz-repository";
import { MockQuizGenerator } from "@/server/ai/mock-quiz-generator";
import { betterAuth } from "better-auth";
import { authOptions } from "@/server/auth/options";
import { consumePreviewQuota } from "@/server/db/quiz-history";
import { PostgresPlayRepository, consumePlayQuota } from '@/server/db/play-repository';

const execute = promisify(execFile);
const testDatabase = `quizquiz_test_${randomUUID().replaceAll("-", "")}`;
let admin: Client;
let pool: Pool;
let repository: PostgresQuizRepository;
let testUrl: string;
let created = false;
let auth: ReturnType<typeof betterAuth>;

async function command(action: string) {
  await execute(process.execPath, ["scripts/db.mjs", action], {
    env: { ...process.env, DATABASE_URL: testUrl }, timeout: 20_000,
  });
}

beforeAll(async () => {
  // The test creates and drops ONLY its own random database, never the development DB.
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5433" || url.pathname !== "/quizquiz") {
    throw new Error("DB integration tests require the local quizquiz database on port 5433. Run npm run db:setup.");
  }
  admin = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${testDatabase}"`);
  created = true;
  url.pathname = `/${testDatabase}`;
  testUrl = url.toString();
  await command("migrate");
  pool = new Pool({ connectionString: testUrl, max: 2, connectionTimeoutMillis: 5000 });
  repository = new PostgresQuizRepository(pool);
  auth = betterAuth(authOptions(pool, randomUUID() + randomUUID(), "http://localhost:3000"));
});

describe("accounts and authorization", () => {
  let cookie: string;
  let userId: string;
  const email = "integration@example.test";
  const password = "Test123!";
  async function authRequest(path: string, body?: unknown, session?: string, origin = "http://localhost:3000", ip = "192.0.2.10") {
    return auth.handler(new Request(`http://localhost:3000/api/auth/${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", origin, "x-forwarded-for": ip, ...(session ? { cookie: session } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }));
  }

  it("accepts an eight-character password and creates a hashed credential and HttpOnly session", async () => {
    const response = await authRequest("sign-up/email", { name: "테스트 사용자", email, password });
    expect(response.status).toBe(200);
    const body = await response.json();
    userId = body.user.id;
    const cookies = response.headers.getSetCookie();
    const sessionCookie = cookies.find(value => value.startsWith("quizquiz.session_token="))!;
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie.toLowerCase()).toContain("samesite=lax");
    cookie = sessionCookie.split(";")[0];
    const account = await pool.query('SELECT password FROM public.auth_account WHERE "userId"=$1', [userId]);
    expect(account.rows[0].password).toBeTruthy();
    expect(account.rows[0].password).not.toBe(password);
    const session = await authRequest("get-session", undefined, cookie);
    expect((await session.json()).user.id).toBe(userId);
  });

  it("rejects a seven-character password and a cross-origin signup", async () => {
    expect((await authRequest("sign-up/email", { name: "테스트", email: "short@example.test", password: "Test12!" })).status).toBe(400);
    expect((await authRequest("sign-up/email", { name: "테스트", email: "csrf@example.test", password }, undefined, "https://evil.example")).status).toBe(403);
  });

  it("does not authenticate incorrect passwords or tampered sessions", async () => {
    expect((await authRequest("sign-in/email", { email, password: "incorrect-password" })).status).toBe(401);
    expect(await (await authRequest("get-session", undefined, `${cookie}tampered`)).json()).toBeNull();
  });

  it("restricts stored quiz reads to the actual owner", async () => {
    const draft = await generateQuiz({ category: "science", difficulty: "hard", count: 3 }, new MockQuizGenerator());
    const owner = new PostgresQuizRepository(pool, userId);
    await owner.save(draft);
    expect(await owner.findById(draft.id)).toEqual(draft);
    expect(await new PostgresQuizRepository(pool, "different-user").findById(draft.id)).toBeNull();
    const stored = await pool.query("SELECT owner_id FROM quizquiz.quizzes WHERE id=$1", [draft.id]);
    expect(stored.rows[0].owner_id).toBe(userId);
  });

  it("enforces a shared quota even with concurrent requests and resets after a minute", async () => {
    const attempts = await Promise.all(Array.from({ length: 15 }, () => consumePreviewQuota(userId, pool)));
    expect(attempts.filter(Boolean)).toHaveLength(10);
    await pool.query("UPDATE quizquiz.preview_limits SET started_at=now()-interval '61 seconds' WHERE user_id=$1", [userId]);
    expect(await consumePreviewQuota(userId, pool)).toBe(true);
  });

  it("rate limits repeated login failures in the database", async () => {
    let status = 0;
    for (let i = 0; i < 6; i++) {
      status = (await authRequest("sign-in/email", { email, password: "incorrect-password" }, undefined, "http://localhost:3000", "192.0.2.22")).status;
    }
    expect(status).toBe(429);
  });

  it("revokes the stored session on logout and permits a fresh login", async () => {
    expect((await authRequest("sign-out", {}, cookie)).status).toBe(200);
    expect(await (await authRequest("get-session", undefined, cookie)).json()).toBeNull();
    const response = await authRequest("sign-in/email", { email, password }, undefined, "http://localhost:3000", "192.0.2.33");
    expect(response.status).toBe(200);
    const newCookie = response.headers.getSetCookie().find(value => value.startsWith("quizquiz.session_token="))!.split(";")[0];
    expect(newCookie).not.toBe(cookie);
    expect((await (await authRequest("get-session", undefined, newCookie)).json()).user.id).toBe(userId);
  });
});

afterAll(async () => {
  await pool?.end();
  try {
    if (created) await admin.query(`DROP DATABASE "${testDatabase}"`);
  } finally {
    await admin?.end();
  }
});

describe("PostgreSQL persistence", () => {
  it("applies migrations and seeds repeatedly without duplicate data", async () => {
    await command("migrate");
    await command("seed");
    await command("seed");
    const migrations = await pool.query("SELECT count(*)::int AS count FROM quizquiz.schema_migrations");
    expect(migrations.rows[0].count).toBe(5);
    const sample = await repository.findById("98c2d9a0-6990-4d57-8c81-b31704315a48");
    expect(sample?.questions).toHaveLength(3);
    expect(sample?.metadata.verificationStatus).toBe("unreviewed");
    const questions = await pool.query("SELECT count(*)::int AS count FROM quizquiz.quiz_questions WHERE quiz_id = $1", [sample!.id]);
    expect(questions.rows[0].count).toBe(3);
  });

  it("round-trips a generated draft with ordered options, answers and provenance", async () => {
    const draft = await generateQuiz({ category: "science", difficulty: "medium", count: 5 }, new MockQuizGenerator());
    await repository.save(draft);
    // New connection verifies persistence beyond a repository/pool instance.
    const anotherPool = new Pool({ connectionString: testUrl, max: 1 });
    try {
      const saved = await new PostgresQuizRepository(anotherPool).findById(draft.id);
      expect(saved).toEqual(draft);
      expect(getQuizPreview(saved!).questions[0]).not.toHaveProperty("correctAnswerIndex");
      expect(getQuizPreview(saved!)).not.toHaveProperty("metadata");
    } finally {
      await anotherPool.end();
    }
    const timestamps = await pool.query("SELECT created_at FROM quizquiz.quizzes WHERE id = $1", [draft.id]);
    expect(timestamps.rows[0].created_at).toBeInstanceOf(Date);
  });

  it("does not overwrite immutable drafts when the same ID is saved again", async () => {
    const draft = await generateQuiz({ category: "history", difficulty: "easy", count: 1 }, new MockQuizGenerator());
    await repository.save(draft);
    const modified = structuredClone(draft);
    modified.questions[0].question = "덮어쓰면 안 되는 문제";
    await expect(repository.save(modified)).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
    expect(await repository.findById(draft.id)).toEqual(draft);
  });

  it("rolls back the parent and earlier questions when a later insert fails", async () => {
    const draft = await generateQuiz({ category: "general", difficulty: "easy", count: 3 }, new MockQuizGenerator());
    draft.questions[2].question = "rollback-fixture";
    await pool.query("ALTER TABLE quizquiz.quiz_questions ADD CONSTRAINT test_reject_question CHECK (question <> 'rollback-fixture')");
    try {
      await expect(repository.save(draft)).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
      expect(await repository.findById(draft.id)).toBeNull();
      const rows = await pool.query("SELECT id FROM quizquiz.quiz_questions WHERE quiz_id = $1", [draft.id]);
      expect(rows.rowCount).toBe(0);
    } finally {
      await pool.query("ALTER TABLE quizquiz.quiz_questions DROP CONSTRAINT test_reject_question");
    }
  });

  it("returns null for missing IDs and malformed identifiers", async () => {
    expect(await repository.findById(randomUUID())).toBeNull();
    expect(await repository.findById("' OR 1=1 --")).toBeNull();
  });

  it("rejects invalid answer indexes at the database boundary", async () => {
    await expect(pool.query(`UPDATE quizquiz.quiz_questions SET correct_answer_index = 4
      WHERE quiz_id = $1 AND position = 0`, ["98c2d9a0-6990-4d57-8c81-b31704315a48"]))
      .rejects.toMatchObject({ code: "23514" });
  });

  it("rejects incomplete stored drafts rather than returning partial quizzes", async () => {
    const draft = await generateQuiz({ category: "culture", difficulty: "easy", count: 2 }, new MockQuizGenerator());
    await repository.save(draft);
    await pool.query("DELETE FROM quizquiz.quiz_questions WHERE quiz_id = $1 AND position = 1", [draft.id]);
    await expect(repository.findById(draft.id)).rejects.toMatchObject({ code: "INVALID_STORED_QUIZ" });
  });
});

describe('question bank, play and community feedback', () => {
  let play: PostgresPlayRepository;
  const users = Array.from({ length: 4 }, () => randomUUID());
  const startInput = () => ({ requestId: randomUUID(), category: 'all' as const, difficulty: 'all' as const, count: 5 });
  beforeAll(async () => {
    play = new PostgresPlayRepository(pool);
    for (const [index, id] of users.entries()) await pool.query(`INSERT INTO public.auth_user (id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,'Play tester',$2,false,now(),now())`, [id, `play-${index}@example.test`]);
  });
  it('starts from published questions, preserves shuffled answers privately and retries starts idempotently', async () => {
    const input = startInput();
    const [a,b] = await Promise.all([play.start(users[0], input), play.start(users[0], input)]);
    expect(a).toEqual(b); expect(a.questions).toHaveLength(5);
    expect(new Set(a.questions.map(q => q.id)).size).toBe(5);
    for (const q of a.questions) {
      expect(q).not.toHaveProperty('result'); expect(q).not.toHaveProperty('correct_answer_index'); expect(q).not.toHaveProperty('explanation');
      const stored = await pool.query('SELECT options,correct_answer_index FROM quizquiz.play_items WHERE session_id=$1 AND position=$2',[a.id,q.position]);
      const bank = await pool.query('SELECT options,correct_answer_index FROM quizquiz.bank_questions WHERE id=$1',[q.id]);
      expect(stored.rows[0].options[stored.rows[0].correct_answer_index]).toBe(bank.rows[0].options[bank.rows[0].correct_answer_index]);
    }
    expect(await play.get(users[0],a.id)).toEqual(a);
    await expect(play.get(users[1],a.id)).rejects.toMatchObject({ status: 404 });
    await expect(play.start(users[1],input)).rejects.toMatchObject({ status: 404 });
    await expect(play.answer(users[1],a.id,0,0)).rejects.toMatchObject({ status: 404 });
  });
  it('prioritizes unseen questions, reuses only when exhausted and keeps sessions isolated', async () => {
    const history = await play.history(users[0]);
    const first = await play.get(users[0], history[0].id);
    const second = await play.start(users[0],startInput());
    expect(second.questions.every(q => !first.questions.some(old => old.id === q.id))).toBe(true);
    expect(second.questions.every(q => !q.isReview)).toBe(true);
    const third = await play.start(users[0],startInput());
    expect(third.questions.every(q => q.isReview)).toBe(true);
  });
  it('requires a submitted answer for ratings/reports and grades only the current question once', async () => {
    const s = await play.start(users[1],startInput());
    await expect(play.rate(users[1],s.questions[0].id,{ value: 1 })).rejects.toMatchObject({ status: 403 });
    await expect(play.report(users[1],s.questions[0].id,'answer')).rejects.toMatchObject({ status: 403 });
    await expect(play.answer(users[1],s.id,1,0)).rejects.toMatchObject({ code: 'OUT_OF_ORDER' });
    const key = await pool.query('SELECT correct_answer_index FROM quizquiz.play_items WHERE session_id=$1 AND position=0',[s.id]);
    const answer = key.rows[0].correct_answer_index;
    const [one,two] = await Promise.all([play.answer(users[1],s.id,0,answer), play.answer(users[1],s.id,0,answer)]);
    expect(one).toEqual(two); expect(one.score).toBe(1); expect(one.questions[0].result?.correct).toBe(true);
    expect(one.questions[0].result?.sources.length).toBeGreaterThan(0); expect(one.questions[1].result).toBeUndefined();
    await expect(play.answer(users[1],s.id,0,(answer+1)%4)).rejects.toMatchObject({ code: 'ALREADY_ANSWERED' });
    for (let i=1;i<s.questions.length;i++) await play.answer(users[1],s.id,i,0);
    expect((await play.get(users[1],s.id)).completed).toBe(true);
    expect((await play.history(users[1]))[0].answered).toBe(5);
  });
  it('upserts one vote per account, including changes across repeated plays', async () => {
    const history = await play.history(users[1]); const s = await play.get(users[1], history[0].id); const qid = s.questions[0].id;
    await Promise.all(Array.from({ length: 6 }, () => play.rate(users[1],qid,{ value: 1 })));
    let rows = await pool.query('SELECT * FROM quizquiz.question_ratings WHERE question_id=$1 AND user_id=$2',[qid,users[1]]);
    expect(rows.rowCount).toBe(1); expect(rows.rows[0].value).toBe(1);
    await play.rate(users[1],qid,{ value: -1, reason: 'options' });
    rows = await pool.query('SELECT * FROM quizquiz.question_ratings WHERE question_id=$1 AND user_id=$2',[qid,users[1]]);
    expect(rows.rowCount).toBe(1); expect(rows.rows[0].value).toBe(-1); expect(rows.rows[0].reason).toBe('options');
    expect((await play.get(users[1],s.id)).questions[0].rating).toEqual({ value: -1, reason: 'options' });
  });
  it('counts distinct reporters atomically, pauses new exposure and queues minority reports too', async () => {
    const qid = '70000000-0000-4000-8000-000000000001';
    for (const user of users.slice(0,3)) {
      const s = await play.start(user,{ ...startInput(), category: 'general', difficulty: 'medium', count: 1 });
      await play.answer(user,s.id,0,0);
    }
    await Promise.all(Array.from({ length: 5 }, () => play.report(users[0],qid,'answer')));
    expect((await pool.query('SELECT status FROM quizquiz.bank_questions WHERE id=$1',[qid])).rows[0].status).toBe('published');
    await Promise.all([play.report(users[1],qid,'explanation'), play.report(users[2],qid,'answer')]);
    expect((await pool.query('SELECT status FROM quizquiz.bank_questions WHERE id=$1',[qid])).rows[0].status).toBe('paused');
    expect((await pool.query('SELECT count(*)::int AS n FROM quizquiz.question_reports WHERE question_id=$1',[qid])).rows[0].n).toBe(3);
    await expect(play.start(users[3], { ...startInput(), category: 'general', difficulty: 'medium' })).rejects.toMatchObject({ code: 'EMPTY_BANK' });
    const s = await play.start(users[3],{ ...startInput(), count: 10 });
    expect(s.questions).toHaveLength(9); expect(s.questions.some(q => q.id === qid)).toBe(false);
  });
  it('enforces independent database-backed action quotas under concurrency', async () => {
    const attempts = await Promise.all(Array.from({ length: 14 }, () => consumePlayQuota(users[3],'start',pool)));
    expect(attempts.filter(Boolean)).toHaveLength(10);
    expect(await consumePlayQuota(users[3],'feedback',pool)).toBe(true);
  });
  it('imports only drafts, prevents publication without sources and supports reviewed recovery', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
    const temp = await mkdtemp(join(tmpdir(),'quiz-bank-'));
    const id = randomUUID(); const file = join(temp,'questions.json');
    const q = { id,category:'science',difficulty:'medium',question:'Operator import fixture?',options:['a','b','c','d'],correctAnswerIndex:1,explanation:'Fixture only',sources:[] as {title:string;url:string}[] };
    const cli = (...args: string[]) => execute(process.execPath,['scripts/bank.mjs',...args],{env:{...process.env,DATABASE_URL:testUrl},timeout:20000});
    try {
      await writeFile(file,JSON.stringify([q])); await cli('import',file);
      expect((await pool.query('SELECT status FROM quizquiz.bank_questions WHERE id=$1',[id])).rows[0].status).toBe('draft');
      await expect(cli('publish',id,'tester','verified')).rejects.toThrow();
      q.sources=[{title:'Example source',url:'https://example.com'}];
      await writeFile(file,JSON.stringify([q])); await cli('import',file); await cli('publish',id,'tester','test review');
      await expect(cli('import',file)).rejects.toThrow();
      await cli('retire',id,'tester','test finished');
      await expect(cli('pause',id,'tester','cannot restore retired content')).rejects.toThrow();
      await expect(cli('publish',id,'tester','cannot restore retired content')).rejects.toThrow();
      const queue = JSON.parse((await cli('queue')).stdout);
      expect(queue.some((item: {id: string; open_reports: number}) => item.id==='70000000-0000-4000-8000-000000000001' && item.open_reports===3)).toBe(true);
      await cli('publish','70000000-0000-4000-8000-000000000001','tester','report review fixture');
      expect((await pool.query("SELECT count(*)::int AS n FROM quizquiz.question_reports WHERE status='open'")).rows[0].n).toBe(0);
    } finally { await rm(temp,{recursive:true,force:true}); }
  });
});
