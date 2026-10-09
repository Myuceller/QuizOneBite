import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), submit: vi.fn(), history: vi.fn() }));
vi.mock('@/server/auth', () => ({ getAuth: () => ({ api: { getSession: mocks.session } }) }));
vi.mock('@/server/db/pool', () => ({ getDatabasePool: () => ({}) }));
vi.mock('@/server/db/submission-repository', () => ({ PostgresSubmissionRepository: class { submit = mocks.submit; history = mocks.history; } }));
import { GET, POST } from '@/app/api/submissions/route';
const input = { requestId:'90f0b8e4-7cd4-47a7-9487-6701c61b1b60', subcategory:'science-earth',difficulty:'easy',question:'차가운 컵의 겉면에 물이 생기는 이유는 무엇일까요?',options:['응결','증발','승화','융해'],correctAnswerIndex:0,explanation:'주변 공기 속 수증기가 차가운 컵에서 액체로 변하기 때문입니다.',sourceTitle:'테스트 출처',sourceUrl:'https://example.com/science' };
const request = (body: unknown = input, origin='https://quiz.example') => new Request('https://quiz.example/api/submissions',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(() => { vi.clearAllMocks();vi.stubEnv('BETTER_AUTH_URL','https://quiz.example');mocks.session.mockResolvedValue({user:{id:'actual-user'}});mocks.submit.mockResolvedValue({id:'saved',status:'pending'});mocks.history.mockResolvedValue([]); });
describe('community submission boundary', () => {
 it('requires a session for writing and reading',async()=>{mocks.session.mockResolvedValue(null);expect((await POST(request())).status).toBe(401);expect((await GET(new Request('https://quiz.example/api/submissions'))).status).toBe(401);expect(mocks.submit).not.toHaveBeenCalled();});
 it('rejects cross-origin writes',async()=>{expect((await POST(request(input,'https://other.example'))).status).toBe(403);expect(mocks.submit).not.toHaveBeenCalled();});
 it('derives owner from the session and scopes history',async()=>{expect((await POST(request())).status).toBe(200);expect(mocks.submit).toHaveBeenCalledWith('actual-user',input);const response=await GET(new Request('https://quiz.example/api/submissions?userId=other'));expect(response.headers.get('cache-control')).toBe('no-store');expect(mocks.history).toHaveBeenCalledWith('actual-user');});
 it.each([{...input,userId:'other'},{...input,status:'approved'},{...input,subcategory:'fake'},{...input,options:['같음','같음','다름','보기']},{...input,sourceUrl:'javascript:alert(1)'},{...input,correctAnswerIndex:4}])('rejects invalid or privileged input',async body=>{expect((await POST(request(body))).status).toBe(400);expect(mocks.submit).not.toHaveBeenCalled();});
 it('bounds request size',async()=>{expect((await POST(request({...input,question:'가'.repeat(9000)}))).status).toBe(413);expect(mocks.submit).not.toHaveBeenCalled();});
});
