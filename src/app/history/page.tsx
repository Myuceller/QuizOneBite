import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { requireUser } from "@/server/auth/session";
import { listQuizHistory } from "@/server/db/quiz-history";
import { categoryLabels, difficultyLabels } from "@/features/quiz/domain/labels";

export const metadata = { title: "내 문제 모음 · 퀴즈퀴즈" };
export default async function HistoryPage() {
  const user = await requireUser();
  const history = await listQuizHistory(user.id);
  return <main className="app-shell"><SiteHeader /><section className="intro">
    <p className="eyebrow">나의 호기심 기록</p><h1>{user.name}님의<br />문제 모음.</h1>
    <p className="intro-description">최근 만든 문제 모음 30개를 다시 살펴볼 수 있어요.</p>
  </section>
    {history.length ? <ul className="history-list">{history.map(item => <li key={item.id}><Link href={`/history/${item.id}`}>
      <span className="history-category">{categoryLabels[item.category]}</span>
      <span><strong>{categoryLabels[item.category]} · {difficultyLabels[item.difficulty]}</strong><small>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(item.created_at)} · {item.question_count}문제</small></span><span aria-hidden="true">→</span>
    </Link></li>)}</ul> : <div className="empty-state preview-panel"><span className="empty-symbol" aria-hidden="true">?</span><p>첫 번째 호기심을 담아볼까요?</p><span>로그인한 상태에서 문제를 만들면 여기에 저장돼요.</span></div>}
    <Link className="primary-button button-link retry-button" href="/">새 문제 만나기</Link><SiteFooter /></main>;
}
