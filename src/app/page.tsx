import Link from "next/link";
import { LearningHub } from "@/features/play/components/learning-hub";
import { getPlayRepository } from "@/server/db/play-repository";
import { PlayLauncher } from "@/features/play/components/play-launcher";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCurrentUser } from "@/server/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  const dashboard = user ? await getPlayRepository().dashboard(user.id) : null;
  return (
    <main className="app-shell">
      <SiteHeader />

      <section className="intro home-intro" aria-labelledby="page-title">
        <div className="intro-copy">
        <p className="eyebrow">{user ? `${user.name}님, 오늘은 무엇이 궁금하세요?` : "하루의 작은 궁금증"}</p>
        <h1 id="page-title">아는 것도, 새로운 것도.<br />상식 퀴즈로 만나보세요.</h1>
        <p className="intro-description">
          네 가지 보기에서 답을 고르고, 새로운 상식을 한 입씩 알아가세요.
        </p>
        </div>
        <div className="quiz-stack" aria-hidden="true">
          <span className="stack-spark spark-one">✦</span><span className="stack-spark spark-two">✦</span>
          <div className="stack-card stack-back" />
          <div className="stack-card stack-middle" />
          <div className="stack-card stack-front"><span className="stack-label">오늘의 한 입</span><strong>Q<span>.</span></strong><div className="stack-options"><i /><i /><i>✓</i><i /></div></div>
          <span className="stack-sticker">아하! <span>✓</span></span>
        </div>
      </section>

      {!user && <div className="join-banner"><div><strong>함께 고르는 좋은 문제.</strong><p>풀고, 해설을 읽고, 마음에 든 문제에 한 표를 남겨요.</p></div><Link href="/signup">무료로 시작하기 <span aria-hidden="true">→</span></Link></div>}
      {dashboard && <LearningHub dashboard={dashboard} />}
      <PlayLauncher signedIn={!!user} />

      <div className="play-links"><Link href="/submit">내가 아는 상식으로 문제 제안하기 →</Link></div>
      <SiteFooter />
    </main>
  );
}
