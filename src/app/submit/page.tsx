import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { requireUser } from '@/server/auth/session';
import { getDatabasePool } from '@/server/db/pool';
import { PostgresSubmissionRepository } from '@/server/db/submission-repository';
import { SubmissionForm } from '@/features/submissions/components/submission-form';
export const metadata = { title: '문제 제안 · 퀴즈퀴즈' };
export default async function SubmitPage() {
  const user = await requireUser();
  const history = await new PostgresSubmissionRepository(getDatabasePool()).history(user.id);
  return <main className="app-shell"><SiteHeader /><section className="intro"><p className="eyebrow">아는 것을 나누는 즐거움</p><h1>당신의 상식도<br />누군가의 발견이 되도록.</h1><p className="intro-description">문제와 해설, 확인한 출처를 보내 주세요.<br />검토를 통과한 문제는 모두가 함께 풀 수 있어요.</p></section><SubmissionForm initial={history} /><SiteFooter /></main>;
}
