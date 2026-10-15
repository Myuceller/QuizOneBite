import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { requireUser } from '@/server/auth/session';
import { getPlayRepository } from '@/server/db/play-repository';
import { categoryLabels } from '@/features/quiz/domain/labels';
import { LearningHub } from '@/features/play/components/learning-hub';
import { StartLearningButton } from '@/features/play/components/learning-actions';
import styles from '@/features/play/components/learning.module.css';
export const metadata = { title: '나의 상식 · 퀴즈퀴즈' };
export default async function LearningPage() {
  const user = await requireUser();
  const dashboard = await getPlayRepository().dashboard(user.id);
  const answered = dashboard.categories.reduce((sum, c) => sum + c.answered, 0);
  const correct = dashboard.categories.reduce((sum, c) => sum + c.correct, 0);
  return <main className="app-shell"><SiteHeader /><section className="intro"><p className="eyebrow">나의 상식</p><h1>쌓이는 기록, 자라는 상식.</h1><p className="intro-description">{answered ? `지금까지 ${answered}문제 풀이 · ${correct}개 정답 · 정답률 ${Math.round(correct / answered * 100)}%` : '첫 문제를 풀면 분야별 성적이 쌓여요.'}</p></section>
    <LearningHub dashboard={dashboard} />
    <section className={styles.section} aria-labelledby="stats-title"><h2 id="stats-title">분야별 내 성적</h2><p className="bank-note">직접 제출한 모든 답을 집계해요. 복습과 무한모드의 반복 풀이도 포함합니다.</p><ul className={styles.stats}>{Object.entries(categoryLabels).map(([category, label]) => {
      const stats = dashboard.categories.find(c => c.category === category);
      const count = stats?.answered ?? 0; const score = stats?.correct ?? 0; const accuracy = count ? Math.round(score / count * 100) : 0;
      return <li className={styles.stat} key={category}><h3>{label}</h3><p>{count ? `${count}문제 풀이 · ${score}개 정답 · 정답률 ${accuracy}%` : '아직 풀어본 문제가 없어요.'}</p><progress className={styles.meter} max={100} value={accuracy} aria-label={`${label} 정답률 ${count ? `${accuracy}%` : '기록 없음'}`} /><StartLearningButton category={category as keyof typeof categoryLabels}>{label} 도전하기</StartLearningButton></li>;
    })}</ul></section>
    <section className={styles.section} aria-labelledby="daily-history-title"><h2 id="daily-history-title">오늘의 5문제 참여 기록</h2><p className="bank-note">최근 30일 · 한국 시간 기준 · 완료 {dashboard.participation.filter(d => d.completed).length}일</p>{dashboard.participation.length ? <ul className={styles.days}>{dashboard.participation.map(d => <li key={d.day}><time dateTime={d.day}>{d.day}</time><span>{d.completed ? `완료 · ${d.score}/5 정답` : '풀이 중'}</span></li>)}</ul> : <p>오늘의 5문제를 풀고 첫 기록을 남겨보세요.</p>}</section>
    <div className="play-links"><Link href="/play/history">전체 풀이 기록</Link><Link href="/">퀴즈 고르기</Link></div><SiteFooter /></main>;
}
