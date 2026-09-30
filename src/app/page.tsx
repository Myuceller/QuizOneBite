import Link from "next/link";
import { QuizPreview } from "@/features/quiz/components/quiz-preview";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCurrentUser } from "@/server/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  return (
    <main className="app-shell">
      <SiteHeader />

      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">{user ? `${user.name}님, 오늘은 무엇이 궁금하세요?` : "하루의 작은 궁금증"}</p>
        <h1 id="page-title">아는 것도, 새로운 것도.<br />상식 퀴즈로 만나보세요.</h1>
        <p className="intro-description">
          관심 있는 주제와 난이도를 골라 문제 구성을 미리 살펴보세요.
        </p>
      </section>

      {!user && <div className="join-banner"><div><strong>호기심에도 나만의 서랍이 있다면.</strong><p>로그인하면 만든 문제를 모아두고 다시 볼 수 있어요.</p></div><Link href="/signup">무료로 시작하기 <span aria-hidden="true">→</span></Link></div>}
      <QuizPreview signedIn={!!user} requiresLogin={process.env.NODE_ENV === "production"} />

      <SiteFooter />
    </main>
  );
}
