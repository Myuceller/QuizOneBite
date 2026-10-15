import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/play/route';
import { POST as answer } from '@/app/api/play/[id]/answer/route';
import { POST as rate } from '@/app/api/questions/[id]/rating/route';
import { POST as report } from '@/app/api/questions/[id]/report/route';
import { GET } from '@/app/api/play/[id]/route';
import { POST as next } from '@/app/api/play/[id]/next/route';
import { POST as bookmark } from '@/app/api/questions/[id]/bookmark/route';
import { POST as finish } from '@/app/api/play/[id]/finish/route';
const { session, quota, repo } = vi.hoisted(() => ({ session: vi.fn(), quota: vi.fn(), repo: { bookmark: vi.fn(), start: vi.fn(), answer: vi.fn(), next: vi.fn(), finish: vi.fn(), rate: vi.fn(), report: vi.fn(), get: vi.fn() } }));
vi.mock('@/server/auth', () => ({ getAuth: () => ({ api: { getSession: session } }) }));
vi.mock('@/server/db/play-repository', () => ({ getPlayRepository: () => repo, consumePlayQuota: quota }));
const id = randomUUID();
const params = { params: Promise.resolve({ id }) };
function request(body: unknown, origin = 'https://quiz.example') { return new Request('https://quiz.example/api/play', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('BETTER_AUTH_URL', 'https://quiz.example'); session.mockResolvedValue({ user: { id: 'owner' } }); quota.mockResolvedValue(true); repo.start.mockResolvedValue({ id }); });
afterEach(() => vi.unstubAllEnvs());
describe('play API boundary', () => {
  it('requires authentication for every endpoint', async () => {
    session.mockResolvedValue(null);
    for (const response of [await POST(request({})), await answer(request({}),params), await next(request({}),params), await finish(request({}),params), await bookmark(request({}),params), await rate(request({}),params), await report(request({}),params), await GET(new Request('https://quiz.example/api/play/'+id),params)]) expect(response.status).toBe(401);
    expect(repo.start).not.toHaveBeenCalled();
  });
  it('rejects cross-site and originless mutations before accessing storage', async () => {
    expect((await POST(request({}, 'https://evil.example'))).status).toBe(403);
    const missing = request({}); missing.headers.delete('origin');
    expect((await rate(missing,params)).status).toBe(403);
    expect(session).not.toHaveBeenCalled();
  });
  it('uses server identity and rejects client owner or answer injection', async () => {
    expect((await POST(request({ requestId: id, userId: 'other' }))).status).toBe(400);
    expect((await answer(request({ position: 0, answerIndex: 4 }),params)).status).toBe(400);
    const response = await POST(request({ requestId: id }));
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(repo.start).toHaveBeenCalledWith('owner', { requestId: id, category: 'all', difficulty: 'all', count: 5 });
  });
  it('validates feedback reasons, malformed IDs and shared quotas', async () => {
    expect((await rate(request({ value: -1 }),params)).status).toBe(400);
    expect((await report(request({ reason: 'something' }),params)).status).toBe(400);
    expect((await GET(new Request('https://quiz.example'), { params: Promise.resolve({ id: 'invalid' }) })).status).toBe(404);
    quota.mockResolvedValue(false);
    expect((await POST(request({ requestId: id }))).status).toBe(429);
    expect(repo.start).not.toHaveBeenCalled();
  });
  it('never returns raw database errors', async () => {
    repo.start.mockRejectedValueOnce(new Error('postgresql://secret'));
    const response = await POST(request({ requestId: id }));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
  });
  it('validates endless requests and keeps owner, sequence and grading on the server', async () => {
    expect((await POST(request({ requestId: id, mode: 'endless' }))).status).toBe(200);
    expect(repo.start).toHaveBeenCalledWith('owner', expect.objectContaining({ mode: 'endless' }));
    expect((await next(request({ position: 25 }),params)).status).toBe(200);
    expect(repo.next).toHaveBeenCalledWith('owner', id, 25);
    expect((await answer(request({ position: 25, answerIndex: 1 }),params)).status).toBe(200);
    expect(repo.answer).toHaveBeenCalledWith('owner', id, 25, 1);
    expect((await finish(request({}),params)).status).toBe(200);
    expect(repo.finish).toHaveBeenCalledWith('owner', id);
    for (const position of [-1, 1.5, 2147483648]) expect((await next(request({ position }),params)).status).toBe(400);
    expect((await finish(request({ score: 100 }),params)).status).toBe(400);
    expect((await next(request({ position: 0 },'https://evil.example'),params)).status).toBe(403);
    expect((await finish(request({},'https://evil.example'),params)).status).toBe(403);
    quota.mockResolvedValue(false);
    expect((await next(request({ position: 0 }),params)).status).toBe(429);
  });
});

describe('learning API boundaries', () => {
  it('validates source combinations and preserves server identity for bookmarks', async () => {
    expect((await POST(request({ requestId: id, source: 'daily', mode: 'endless' }))).status).toBe(400);
    expect((await POST(request({ requestId: id, source: 'standard', questionId: id }))).status).toBe(400);
    expect((await POST(request({ requestId: id, source: 'daily', dailyDay: '2020-01-01' }))).status).toBe(400);
    expect((await POST(request({ requestId: id, source: 'wrong', questionId: id }))).status).toBe(200);
    expect((await bookmark(request({ saved: true, userId: 'other' }),params)).status).toBe(400);
    expect((await bookmark(request({ saved: 'true' }),params)).status).toBe(400);
    expect((await bookmark(request({ saved: true }, 'https://evil.example'),params)).status).toBe(403);
    expect((await bookmark(request({ saved: true }),params)).status).toBe(200);
    expect(repo.bookmark).toHaveBeenCalledWith('owner',id,true);
    quota.mockResolvedValue(false);
    expect((await bookmark(request({ saved: false }),params)).status).toBe(429);
  });
});
