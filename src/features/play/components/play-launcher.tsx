'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { categoryLabels, difficultyLabels } from '@/features/quiz/domain/labels';
import type { PlaySession } from '../domain/play';

export function PlayLauncher({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [category, setCategory] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ key: string; id: string } | null>(null);
  async function start(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    const key = `${category}:${difficulty}`;
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    try {
      const response = await fetch('/api/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, difficulty, count: 5, requestId: pending.current.id }) });
      const data = await response.json() as { session?: PlaySession; error?: { message: string } };
      if (!response.ok || !data.session) throw new Error(data.error?.message ?? '문제를 불러오지 못했어요.');
      router.push(`/play/${data.session.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : '연결을 확인해 주세요.'); setLoading(false); }
  }
  return <section aria-labelledby="play-title">
    <div className="section-heading"><h2 id="play-title">오늘의 상식 한 입</h2><span className="muted-text">최대 5문제 · 네 가지 보기</span></div>
    <div className="preview-panel">
      <p className="sample-notice">처음 만나는 문제부터 골라드려요. 풀고 나서 좋은 문제에 한 표를 남겨주세요.</p>
      <form onSubmit={start}><fieldset className="form-fields" disabled={loading}>
        <legend className="visually-hidden">출제 조건</legend>
        <label className="field"><span>주제</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">골고루 섞어서</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field"><span>난이도</span><select value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="all">골고루 섞어서</option>{Object.entries(difficultyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {signedIn ? <button className="primary-button" type="submit">{loading ? '문제 고르는 중…' : '퀴즈 시작하기'}</button> : <Link href="/login" className="primary-button button-link">로그인하고 풀기</Link>}
      </fieldset></form>
      {error && <p className="error-message" role="alert">{error}</p>}
      <p className="bank-note">문제가 적은 조건에서는 가능한 수만 출제해요. 새 문제를 모두 만나면 복습 문제가 섞여요.</p>
    </div>
    <div className="play-links"><Link href="/play/history">내 풀이 기록 →</Link><Link href="/preview">기존 샘플 미리보기 →</Link></div>
  </section>;
}
