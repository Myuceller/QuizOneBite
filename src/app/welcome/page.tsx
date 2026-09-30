import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "환영합니다 · 퀴즈퀴즈" };
export default async function WelcomePage() {
  const user = await requireUser();
  return <main className="app-shell"><SiteHeader /><section className="welcome-section">
    <span className="welcome-symbol" aria-hidden="true">반가워요!</span>
    <p className="eyebrow">당신의 호기심을 환영합니다</p>
    <h1>{user.name}님,<br />퀴즈퀴즈에 잘 오셨어요.</h1>
    <p className="intro-description">익숙한 상식부터 조금 낯선 지식까지.<br />좋아하는 주제로 가볍게 시작해 보세요.</p>
    <ol className="welcome-steps"><li><span>01</span><h2>주제를 고르고</h2><p>과학, 역사, 지리, 문화.<br />오늘 궁금한 분야를 골라요.</p></li><li><span>02</span><h2>생각해 보고</h2><p>네 가지 보기 중에서<br />나만의 답을 떠올려요.</p></li><li><span>03</span><h2>다시 만나고</h2><p>내 문제 모음에서<br />봤던 문제를 다시 살펴봐요.</p></li></ol>
    <Link href="/" className="primary-button button-link">첫 문제 만나러 가기 <span aria-hidden="true">→</span></Link>
  </section><SiteFooter /></main>;
}
