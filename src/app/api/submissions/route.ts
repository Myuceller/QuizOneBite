import { getAuth } from '@/server/auth';
import { getDatabasePool } from '@/server/db/pool';
import { PostgresSubmissionRepository } from '@/server/db/submission-repository';
import { SubmissionError, SubmissionSchema } from '@/features/submissions/domain/submission';
export const runtime = 'nodejs';
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
async function handle(request: Request, write: boolean) {
  try {
    if (write) {
      const origin = process.env.BETTER_AUTH_URL;
      if (!origin) throw new SubmissionError('UNAVAILABLE', '서버 설정을 확인해 주세요.', 503);
      if (request.headers.get('origin') !== new URL(origin).origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new SubmissionError('INVALID_ORIGIN', '허용되지 않은 요청입니다.', 403);
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new SubmissionError('INVALID_INPUT', 'JSON 요청이 필요합니다.', 415);
    }
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) throw new SubmissionError('UNAUTHORIZED', '로그인하고 문제를 제출해 주세요.', 401);
    const repository = new PostgresSubmissionRepository(getDatabasePool());
    if (!write) return json({ submissions: await repository.history(session.user.id) });
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 24000) throw new SubmissionError('INVALID_INPUT', '요청이 너무 큽니다.', 413);
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new SubmissionError('INVALID_INPUT', '입력 형식을 확인해 주세요.'); }
    const parsed = SubmissionSchema.safeParse(value);
    if (!parsed.success) throw new SubmissionError('INVALID_INPUT', '문제와 서로 다른 보기 네 개, 해설, HTTPS 출처를 확인해 주세요.');
    return json({ submission: await repository.submit(session.user.id, parsed.data) });
  } catch (error) {
    if (error instanceof SubmissionError) return json({ error: { code: error.code, message: error.message } }, error.status);
    return json({ error: { code: 'UNAVAILABLE', message: '저장하지 못했어요. 잠시 후 다시 시도해 주세요.' } }, 503);
  }
}
export async function POST(request: Request) { return handle(request, true); }
export async function GET(request: Request) { return handle(request, false); }
