import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { requireUser } from '@/server/auth/session';
import { getPlayRepository } from '@/server/db/play-repository';
import { categoryLabels, difficultyLabels } from '@/features/quiz/domain/labels';
import { BookmarkButton, StartLearningButton } from '@/features/play/components/learning-actions';
import styles from '@/features/play/components/learning.module.css';
export const metadata = { title: '나의 복습 목록 · 퀴즈퀴즈' };
export default async function CollectionPage({ searchParams }: { searchParams: Promise<{ source?: string; page?: string }> }) {
  const user = await requireUser(); const query = await searchParams;
  const source = query.source === 'bookmarks' ? 'bookmarks' : 'wrong';
  const value = Number(query.page); const page = Number.isInteger(value) && value > 0 && value <= 10000 ? value : 1;
  const collection = await getPlayRepository().collection(user.id, source, page);
  const title = source === 'wrong' ? '오답 복습' : '북마크';
  return <main className="app-shell"><SiteHeader /><section className="intro"><p className="eyebrow">나의 상식 모음</p><h1>{title}</h1><p className="intro-description">{source === 'wrong' ? '가장 최근에 틀린 문제예요. 다시 맞히면 이 목록에서 빠져요.' : '풀이 후 저장한 문제예요. 오래 기억하도록 다시 풀어보세요.'} · 총 {collection.total}개</p></section>
    <nav className="play-links" aria-label="복습 목록"><Link aria-current={source === 'wrong' ? 'page' : undefined} href="/play/collection?source=wrong">오답 복습</Link><Link aria-current={source === 'bookmarks' ? 'page' : undefined} href="/play/collection?source=bookmarks">북마크</Link><Link href="/play/learning">분야별 성적</Link></nav>
    {collection.items.length ? <ul className={styles.collection}>{collection.items.map(q => <li className={styles.item} key={q.id}><span className={styles.meta}>{categoryLabels[q.category as keyof typeof categoryLabels]} · {difficultyLabels[q.difficulty as keyof typeof difficultyLabels]}</span><h2>{q.question}</h2><div className={styles.actions}>{q.available ? <StartLearningButton source={source} questionId={q.id}>이 문제 다시 풀기</StartLearningButton> : <p className="bank-note">검토 중인 문제라 지금은 다시 풀 수 없어요.</p>}{source === 'bookmarks' && <BookmarkButton questionId={q.id} saved refresh />}</div></li>)}</ul> : <div className="preview-panel empty-state"><p>{collection.total ? '이 페이지에는 문제가 없어요.' : source === 'wrong' ? '복습할 오답이 없어요!' : '아직 저장한 문제가 없어요.'}</p><Link href="/">새 문제 만나기 →</Link></div>}
    <nav className="play-links" aria-label="목록 페이지">{page > 1 && <Link href={`/play/collection?source=${source}&page=${page-1}`}>← 이전</Link>}<span>{page} / {Math.max(1, Math.ceil(collection.total / 20))}</span>{page * 20 < collection.total && <Link href={`/play/collection?source=${source}&page=${page+1}`}>다음 →</Link>}</nav><SiteFooter /></main>;
}
