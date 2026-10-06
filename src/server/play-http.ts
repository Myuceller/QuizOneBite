import 'server-only';
import { z } from 'zod';
import { getAuth } from './auth';
import { PlayError } from '@/features/play/domain/play';
import { consumePlayQuota } from './db/play-repository';

export const playJson = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export async function playRequest(request: Request, action: 'start' | 'answer' | 'feedback' | 'read', work: (userId: string) => Promise<unknown>) {
  try {
    if (action !== 'read') {
      const expected = process.env.BETTER_AUTH_URL;
      if (!expected) throw new PlayError('UNAVAILABLE', '서버 설정을 확인해 주세요.', 503);
      if (request.headers.get('origin') !== new URL(expected).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
        throw new PlayError('INVALID_ORIGIN', '허용되지 않은 요청입니다.', 403);
      }
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new PlayError('INVALID_INPUT', 'JSON 요청이 필요합니다.', 415);
    }
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) throw new PlayError('UNAUTHORIZED', '로그인하고 퀴즈를 시작해 주세요.', 401);
    if (action !== 'read' && !await consumePlayQuota(session.user.id, action)) throw new PlayError('RATE_LIMITED', '요청이 많아요. 잠시 후 다시 시도해 주세요.', 429);
    return playJson(await work(session.user.id));
  } catch (error) {
    if (error instanceof PlayError) return playJson({ error: { code: error.code, message: error.message } }, error.status);
    return playJson({ error: { code: 'UNAVAILABLE', message: '연결을 확인하고 잠시 후 다시 시도해 주세요.' } }, 503);
  }
}
export async function playBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let value: unknown;
  try {
    const text = await request.text();
    if (text.length > 2048) throw new PlayError('INVALID_INPUT', '요청이 너무 큽니다.', 413);
    value = JSON.parse(text);
  } catch (error) {
    if (error instanceof PlayError) throw error;
    throw new PlayError('INVALID_INPUT', '요청 형식을 확인해 주세요.');
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new PlayError('INVALID_INPUT', '입력값을 확인해 주세요.');
  return parsed.data;
}
export function playId(id: string) {
  if (!z.uuid().safeParse(id).success) throw new PlayError('NOT_FOUND', '문제 기록을 찾을 수 없어요.', 404);
  return id;
}
