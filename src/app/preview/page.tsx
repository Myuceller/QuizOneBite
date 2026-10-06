import { QuizPreview } from '@/features/quiz/components/quiz-preview';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { getCurrentUser } from '@/server/auth/session';
export const metadata = { title: '샘플 미리보기 · 퀴즈퀴즈' };
export default async function PreviewPage() {
  const user = await getCurrentUser();
  return <main className="app-shell"><SiteHeader /><div className="play-section"><QuizPreview signedIn={!!user} requiresLogin={process.env.NODE_ENV === 'production'} /></div><SiteFooter /></main>;
}
