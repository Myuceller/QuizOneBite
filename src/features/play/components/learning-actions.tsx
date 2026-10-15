'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BusyIndicator } from '@/components/busy-indicator';
import type { StartPlay } from '../domain/play';

export function StartLearningButton({ source = 'standard', category = 'all', questionId, disabled = false, children }: {
  source?: StartPlay['source']; category?: StartPlay['category']; questionId?: string; disabled?: boolean; children: React.ReactNode;
}) {
  const router = useRouter();
  const pending = useRef<{ key: string; id: string } | null>(null);
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function start() {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError('');
    const key = `${source}:${category}:${questionId ?? ''}`;
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    try {
      const response = await fetch('/api/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: pending.current.id, source, category, questionId, count: 5 }) });
      const data = await response.json();
      if (!response.ok || !data.session) throw new Error(data.error?.message ?? '문제를 불러오지 못했어요.');
      router.push(`/play/${data.session.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : '연결을 확인해 주세요.'); sending.current = false; setBusy(false); }
  }
  return <div><button className="primary-button" disabled={disabled || busy} aria-busy={busy} onClick={start}>{busy ? <><BusyIndicator />문제 고르는 중…</> : children}</button>{error && <p role="alert" className="error-message">{error}</p>}</div>;
}

export function BookmarkButton({ questionId, saved: initialSaved, onSave, refresh = false }: {
  questionId: string; saved: boolean; onSave?: (saved: boolean) => void; refresh?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  async function toggle() {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/questions/${questionId}/bookmark`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saved: !saved }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error?.message ?? '저장하지 못했어요.'); }
      setSaved(!saved); onSave?.(!saved);
      if (refresh) router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : '연결을 확인해 주세요.'); }
    finally { sending.current = false; setBusy(false); }
  }
  return <div><button className="secondary-button" aria-pressed={saved} aria-busy={busy} disabled={busy} onClick={toggle}>{busy ? <><BusyIndicator />저장 중…</> : saved ? '★ 북마크 해제' : '☆ 북마크 저장'}</button>{error && <p role="alert" className="error-message">{error}</p>}</div>;
}
