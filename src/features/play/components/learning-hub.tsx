import Link from 'next/link';
import type { LearningDashboard } from '../domain/play';
import { StartLearningButton } from './learning-actions';
import styles from './learning.module.css';

export function LearningHub({ dashboard }: { dashboard: LearningDashboard }) {
  const { daily } = dashboard;
  return <section className={styles.hub} aria-labelledby="learning-title">
    <div className="section-heading"><h2 id="learning-title">오늘도 한 입씩 쌓아가요</h2><Link href="/play/learning#stats-title">분야별 내 성적 →</Link></div>
    <div className={styles.cards}>
      <article className={styles.card}><span className={styles.kicker}>{daily.day} · 한국 시간</span><h3>오늘의 5문제</h3><p>{daily.completed ? `오늘도 완료! 5문제 중 ${daily.score}개 정답이에요.` : daily.sessionId ? `${daily.answered}문제 풀었어요. 남은 문제를 이어가세요.` : '매일 바뀌는 공통 문제 5개. 한국 시간 자정에 새로 만나요.'}</p><div className={styles.actions}><StartLearningButton source="daily">{daily.completed ? '오늘 결과 보기' : daily.sessionId ? '오늘 문제 이어 풀기' : '오늘의 5문제 풀기'}</StartLearningButton><Link href="/play/learning#daily-history-title">참여 기록</Link></div></article>
      <article className={styles.card}><span className={styles.kicker}>다시 맞히면 하나씩 줄어요</span><h3>오답 복습</h3><p>{dashboard.wrongCount ? `다시 도전할 문제 ${dashboard.wrongCount}개가 있어요.` : '복습할 오답이 없어요. 새로운 문제에 도전해보세요.'}</p><div className={styles.actions}><StartLearningButton source="wrong" disabled={!dashboard.wrongCount}>틀린 문제만 풀기</StartLearningButton><Link href="/play/collection?source=wrong">오답 목록</Link></div></article>
      <article className={styles.card}><span className={styles.kicker}>기억하고 싶은 상식</span><h3>북마크</h3><p>{dashboard.bookmarkCount ? `다시 풀 수 있는 문제 ${dashboard.bookmarkCount}개를 저장했어요.` : '풀이 후 별표를 눌러 기억하고 싶은 문제를 저장하세요.'}</p><div className={styles.actions}><StartLearningButton source="bookmarks" disabled={!dashboard.bookmarkCount}>북마크 모아 풀기</StartLearningButton><Link href="/play/collection?source=bookmarks">북마크 목록</Link></div></article>
    </div>
  </section>;
}
