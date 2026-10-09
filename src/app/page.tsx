import Link from "next/link";
import { PlayLauncher } from "@/features/play/components/play-launcher";
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
          네 가지 보기에서 답을 고르고, 새로운 상식을 한 입씩 알아가세요.
        </p>
      </section>

      {!user && <div className="join-banner"><div><strong>함께 고르는 좋은 문제.</strong><p>풀고, 해설을 읽고, 마음에 든 문제에 한 표를 남겨요.</p></div><Link href="/signup">무료로 시작하기 <span aria-hidden="true">→</span></Link></div>}
      <PlayLauncher signedIn={!!user} />

      <div className="play-links"><Link href="/submit">내가 아는 상식으로 문제 제안하기 →</Link></div>
      <SiteFooter />
    </main>
  );
}
