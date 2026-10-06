'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { categoryLabels, difficultyLabels } from '@/features/quiz/domain/labels';
import type { PlaySession, StartPlay } from '../domain/play';
import styles from './play-launcher.module.css';

type Topic = StartPlay['category'];
const topics: { value: Topic; label: string; hint: string }[] = [
  { value: 'all', label: '골고루', hint: '다양한 주제를 한 번에' },
  { value: 'general', label: categoryLabels.general, hint: '일상 속 뜻밖의 발견' },
  { value: 'science', label: categoryLabels.science, hint: '세상이 움직이는 원리' },
  { value: 'history', label: categoryLabels.history, hint: '과거에서 찾는 이야기' },
  { value: 'geography', label: categoryLabels.geography, hint: '지구 곳곳을 한 바퀴' },
  { value: 'culture', label: categoryLabels.culture, hint: '예술부터 생활까지' },
];
const levels: { value: StartPlay['difficulty']; label: string; hint: string; bars: number }[] = [
  { value: 'all', label: '골고루', hint: '다양하게 만나기', bars: 0 },
  { value: 'easy', label: difficultyLabels.easy, hint: '가볍게 몸풀기', bars: 1 },
  { value: 'medium', label: difficultyLabels.medium, hint: '조금 더 생각하기', bars: 2 },
  { value: 'hard', label: difficultyLabels.hard, hint: '제대로 도전하기', bars: 3 },
];
function TopicIcon({ topic }: { topic: Topic }) {
  const paths = {
    all: <><path d="m4 7 3-3 3 3M7 4v11a5 5 0 0 0 5 5h1M20 17l-3 3-3-3M17 20V9a5 5 0 0 0-5-5h-1" /></>,
    general: <><path d="M9 18h6M10 21h4M9 15c0-2-4-3-4-7a7 7 0 0 1 14 0c0 4-4 5-4 7H9Z" /></>,
    science: <><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-45 12 12)" /><circle cx="12" cy="12" r="1" /></>,
    history: <><path d="m3 8 9-5 9 5H3ZM5 11v7M10 11v7M14 11v7M19 11v7M3 21h18" /></>,
    geography: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
    culture: <><path d="M9 18V5l11-2v13M9 8l11-2" /><ellipse cx="6" cy="18" rx="3" ry="3" /><ellipse cx="17" cy="16" rx="3" ry="3" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[topic]}</svg>;
}

export function PlayLauncher({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [category, setCategory] = useState<Topic>('all');
  const [difficulty, setDifficulty] = useState<StartPlay['difficulty']>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ key: string; id: string } | null>(null);
  const starting = useRef(false);
  async function start(event: FormEvent) {
    event.preventDefault();
    if (starting.current || !signedIn) return;
    starting.current = true; setLoading(true); setError('');
    const key = `${category}:${difficulty}`;
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    try {
      const response = await fetch('/api/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, difficulty, count: 5, requestId: pending.current.id }) });
      const data = await response.json() as { session?: PlaySession; error?: { message: string } };
      if (!response.ok || !data.session) throw new Error(data.error?.message ?? '문제를 불러오지 못했어요.');
      router.push(`/play/${data.session.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : '연결을 확인해 주세요.'); starting.current = false; setLoading(false); }
  }
  return <section aria-labelledby="play-title">
    <div className="section-heading"><h2 id="play-title">오늘의 상식 한 입</h2><span className={styles.roundBadge}>최대 5문제 · 네 가지 보기</span></div>
    <form className={styles.panel} onSubmit={start}>
      <fieldset className={styles.group} disabled={loading}>
        <legend className={styles.legend}><span aria-hidden="true">01</span>어떤 주제가 끌리나요?</legend>
        <p className={styles.groupHint}>하나를 고르거나, 골고루 만나보세요.</p>
        <div className={styles.topics}>
          {topics.map(topic => <label key={topic.value} className={styles.topicCard}>
            <input className="visually-hidden" type="radio" name="category" value={topic.value} aria-label={topic.label} checked={category === topic.value} onChange={() => setCategory(topic.value)} />
            <span className={`${styles.topicIcon} ${styles[topic.value]}`}><TopicIcon topic={topic.value} /></span>
            <span className={styles.check} aria-hidden="true">✓</span>
            <strong>{topic.label}</strong><span className={styles.cardHint}>{topic.hint}</span>
          </label>)}
        </div>
      </fieldset>
      <fieldset className={`${styles.group} ${styles.difficulty}`} disabled={loading}>
        <legend className={styles.legend}><span aria-hidden="true">02</span>얼마나 도전해볼까요?</legend>
        <div className={styles.levels}>
          {levels.map(level => <label key={level.value} className={styles.levelCard}>
            <input className="visually-hidden" type="radio" name="difficulty" value={level.value} aria-label={level.label} checked={difficulty === level.value} onChange={() => setDifficulty(level.value)} />
            <span className={styles.levelTop}>
              <span className={styles.levelIcon} aria-hidden="true">{level.bars === 0 ? <TopicIcon topic="all" /> : [1, 2, 3].map(bar => <i key={bar} className={bar <= level.bars ? styles.filled : ''} />)}</span>
              <strong>{level.label}</strong><span className={styles.levelCheck} aria-hidden="true">✓</span>
            </span>
            <span className={styles.cardHint}>{level.hint}</span>
          </label>)}
        </div>
      </fieldset>
      <div className={styles.startRow}>
        <div className={styles.selection}><span>오늘의 한 입</span><strong>{topics.find(topic => topic.value === category)?.label} <span aria-hidden="true">·</span> {difficulty === 'all' ? '모든 난이도' : difficultyLabels[difficulty]}</strong></div>
        {signedIn ? <button className={`primary-button ${styles.startButton}`} type="submit" disabled={loading}>{loading ? '문제 고르는 중…' : '퀴즈 시작하기'}<span aria-hidden="true">→</span></button> : <Link href="/login" className={`primary-button button-link ${styles.startButton}`}>로그인하고 풀기<span aria-hidden="true">→</span></Link>}
      </div>
      <span className="visually-hidden" role="status">{loading ? '문제를 고르고 있어요. 잠시만 기다려 주세요.' : ''}</span>
      {error && <p className="error-message" role="alert">{error}</p>}
      <p className={styles.note}>처음 만나는 문제부터 골라드려요. 조건에 맞는 문제가 적으면 가능한 수만 출제하고, 모두 풀었다면 복습 문제가 섞여요.</p>
    </form>
    <div className="play-links"><Link href="/play/history">내 풀이 기록 →</Link><Link href="/preview">기존 샘플 미리보기 →</Link></div>
  </section>;
}
