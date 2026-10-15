import Link from 'next/link';
import { playSourceLabels } from '@/features/play/domain/play';
import { StartLearningButton } from '@/features/play/components/learning-actions';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { requireUser } from '@/server/auth/session';
import { getPlayRepository } from '@/server/db/play-repository';
export const metadata = { title: '풀이 기록 · 퀴즈퀴즈' };
export default async function PlayHistoryPage() {
  const user = await requireUser(); const history = await getPlayRepository().history(user.id);
  return <main className="app-shell"><SiteHeader /><section className="intro"><p className="eyebrow">나의 상식 기록</p><h1>다시 보고, 더 알아가고.</h1><p className="intro-description">최근 30번의 풀이예요. 이어 풀거나 해설과 평가를 다시 볼 수 있어요.</p></section>
    <div className="play-links"><StartLearningButton source="wrong">틀린 문제 다시 풀기</StartLearningButton><Link href="/play/learning">분야별 내 성적</Link><Link href="/play/collection?source=bookmarks">북마크</Link></div>
    {history.length ? <ul className="history-list">{history.map(item => <li key={item.id}><Link href={`/play/${item.id}`}><span className="history-category">{item.completed ? '완료' : '이어 풀기'}</span><span><strong>{item.mode === 'endless' ? `무한모드 · ${item.answered}문제 풀이` : `${playSourceLabels[item.source]} · ${item.count}문제`} · {item.score}개 정답</strong><small>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date(item.createdAt))} · {item.dailyDay ? `${item.dailyDay} 오늘의 문제 · ` : ''}{item.answered}개 제출</small></span><span aria-hidden="true">→</span></Link></li>)}</ul> : <div className="preview-panel empty-state"><p>아직 풀이 기록이 없어요.</p><span>첫 문제를 만나보세요.</span></div>}
    <div className="play-links"><Link className="primary-button button-link" href="/">새 문제 풀기</Link><Link href="/history">기존 미리보기 모음</Link></div><SiteFooter /></main>;
}
