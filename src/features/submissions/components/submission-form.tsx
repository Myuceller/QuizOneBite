'use client';
import { useRef, useState, type FormEvent } from 'react';
import { QUIZ_SUBCATEGORIES } from '@/features/quiz/domain/taxonomy';
import { getSubcategory } from '@/features/quiz/domain/taxonomy';
import type { SubmissionSummary } from '../domain/submission';
import styles from './submission-form.module.css';
const majors = [...new Map(QUIZ_SUBCATEGORIES.map(s => [s.major, s.majorLabel])).entries()];
const states = { pending: '검토 대기', approved: '게시 승인', rejected: '보완 필요' };
export function SubmissionForm({ initial }: { initial: SubmissionSummary[] }) {
  const [major, setMajor] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [history, setHistory] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const sending = useRef(false);
  const pending = useRef<{ key: string; id: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (sending.current) return;
    const form = event.currentTarget; const data = new FormData(form);
    const value = { subcategory, difficulty: String(data.get('difficulty')), question: String(data.get('question')), options: [0,1,2,3].map(i => String(data.get(`option-${i}`))), correctAnswerIndex: Number(data.get('answer')), explanation: String(data.get('explanation')), sourceTitle: String(data.get('sourceTitle')), sourceUrl: String(data.get('sourceUrl')) };
    const key = JSON.stringify(value);
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    sending.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/submissions', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...value,requestId:pending.current.id}) });
      const result = await response.json() as { submission?: SubmissionSummary; error?: { message: string } };
      if (!response.ok || !result.submission) throw new Error(result.error?.message ?? '제출하지 못했어요.');
      const saved = result.submission;
      setHistory(current => [saved,...current.filter(s => s.id !== saved.id)].slice(0,30));
      pending.current = null; form.reset(); setMajor(''); setSubcategory('');
      setSuccess('문제를 보냈어요! 출처와 내용을 검토한 뒤 게시할게요.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : '연결을 확인해 주세요.'); }
    finally { sending.current = false; setBusy(false); }
  }
  return <div className={styles.layout}>
    <form className={styles.panel} onSubmit={submit}>
      <fieldset disabled={busy} className={styles.fields}>
        <legend className="visually-hidden">새 문제 작성</legend>
        <div className={styles.heading}><span>01</span><h2>어떤 상식인가요?</h2></div>
        <div className={styles.row}>
          <label className="field">대분류<select value={major} required onChange={e => {setMajor(e.target.value);setSubcategory('');}}><option value="">분야 선택</option>{majors.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="field">소분류<select value={subcategory} required disabled={!major} onChange={e => setSubcategory(e.target.value)}><option value="">소분류 선택</option>{QUIZ_SUBCATEGORIES.filter(s => s.major === major).map(s => <option key={s.id} value={s.id}>{s.minor}</option>)}</select></label>
          <label className="field">예상 난이도<select name="difficulty" required defaultValue="medium"><option value="easy">쉬움</option><option value="medium">보통</option><option value="hard">어려움</option></select></label>
        </div>
        <p className={styles.hint}>어려운 문제도 익숙한 소재에서 출발해요. 숫자 계산, 자격증형 지식, 지엽적인 암기는 제외해 주세요.</p>
        <div className={styles.heading}><span>02</span><h2>함께 풀 문제를 써 주세요</h2></div>
        <label className="field">문제<textarea name="question" rows={3} minLength={10} maxLength={500} required placeholder="일상에서 궁금했던 것을 한 문장으로 물어보세요." /></label>
        <fieldset className={styles.options}><legend>보기 네 개 · 정답 하나를 선택해 주세요</legend>{[0,1,2,3].map(i => <div className={styles.option} key={i}>
          <label className={styles.answer}><input type="radio" name="answer" value={i} required aria-label={`${i+1}번을 정답으로 선택`} /><span>{i+1}</span></label>
          <input name={`option-${i}`} aria-label={`${i+1}번 보기`} maxLength={200} required placeholder={`${i+1}번 보기`} />
        </div>)}</fieldset>
        <label className="field">해설<textarea name="explanation" rows={3} minLength={10} maxLength={1000} required placeholder="왜 정답인지 짧고 이해하기 쉽게 설명해 주세요." /></label>
        <div className={styles.heading}><span>03</span><h2>어디에서 확인했나요?</h2></div>
        <label className="field">출처 이름<input name="sourceTitle" maxLength={200} required placeholder="기관·책·문서의 이름" /></label>
        <label className="field">출처 링크<input name="sourceUrl" type="url" pattern="https://.*" maxLength={2000} required placeholder="https://" /></label>
        <p className={styles.hint}>정답을 확인할 수 있는 원문 링크를 남겨 주세요. 개인정보와 다른 문제집의 문항을 그대로 올리지 말아 주세요. 최근 24시간 동안 최대 5개까지 제출할 수 있어요.</p>
        <button className="primary-button" type="submit">{busy ? '문제를 보내고 있어요…' : '검토 요청하기'}</button>
      </fieldset>
      {error && <p className="error-message" role="alert">{error}</p>}
      <p className={styles.success} role="status">{success}</p>
    </form>
    <section className={styles.history} aria-labelledby="submission-history"><h2 id="submission-history">내가 보낸 문제</h2><p className={styles.hint}>최근 30개를 보여드려요. 승인된 문제는 문제 은행에 추가돼요.</p>
      {history.length ? <ul>{history.map(item => <li key={item.id}><div className={styles.meta}><span>{states[item.status]}</span><span>{getSubcategory(item.subcategory).minor}</span></div><h3>{item.question}</h3>{item.reviewNote && <p>{item.reviewNote}</p>}</li>)}</ul> : <div className={styles.empty}>첫 번째 상식을 나눠 주세요.</div>}
    </section>
  </div>;
}
