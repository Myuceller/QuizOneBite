'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { PlayQuestion, PlaySession, Rating, ReportReason } from '../domain/play';

async function post(url: string, body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? '저장하지 못했어요. 다시 시도해 주세요.');
  return data;
}
function QuestionFeedback({ question, onSave }: { question: PlayQuestion; onSave: (rating?: Rating) => void }) {
  const [rating, setRating] = useState<Rating | null>(question.rating);
  const [reported, setReported] = useState(question.reported);
  const [reason, setReason] = useState<'obvious' | 'ambiguous' | 'options'>(question.rating?.value === -1 ? question.rating.reason : 'obvious');
  const [reportReason, setReportReason] = useState<ReportReason>('answer');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function save(next?: Rating) {
    setBusy(true); setError(''); setMessage('');
    try {
      await post(`/api/questions/${question.id}/${next ? 'rating' : 'report'}`, next ?? { reason: reportReason });
      onSave(next);
      if (next) { setRating(next); setMessage('평가를 저장했어요. 나중에 바꿀 수도 있어요.'); }
      else { setReported(true); setMessage('오류 신고를 접수했어요. 다시 확인할게요.'); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : '연결을 확인해 주세요.'); }
    finally { setBusy(false); }
  }
  return <section className="question-feedback" aria-label="이 문제 평가">
    <h3>이 문제, 어땠나요?</h3><p className="bank-note">좋은 문제는 다른 사람에게 더 자주 소개돼요. 평가는 선택이에요.</p>
    <fieldset disabled={busy} className="feedback-fields"><legend className="visually-hidden">좋은 점과 아쉬운 점</legend>
      <button className="secondary-button" aria-pressed={rating?.value === 1} onClick={() => save({ value: 1 })}>👍 좋은 문제예요</button>
      <label className="field"><span>아쉬운 이유</span><select value={reason} onChange={e => setReason(e.target.value as typeof reason)}><option value="obvious">너무 뻔해요</option><option value="ambiguous">문장이 모호해요</option><option value="options">보기가 아쉬워요</option></select></label>
      <button className="secondary-button" aria-pressed={rating?.value === -1} onClick={() => save({ value: -1, reason })}>👎 아쉬워요</button>
    </fieldset>
    <details className="report-panel"><summary>정답이나 해설에 오류가 있나요?</summary>
      {reported ? <p role="status">이 문제는 이미 신고했어요.</p> : <fieldset className="feedback-fields" disabled={busy}><legend className="visually-hidden">오류 신고</legend>
        <label className="field"><span>신고 이유</span><select value={reportReason} onChange={e => setReportReason(e.target.value as ReportReason)}><option value="answer">정답이 틀린 것 같아요</option><option value="explanation">해설이 틀린 것 같아요</option><option value="ambiguous">정답이 여러 개 같아요</option></select></label>
        <button className="secondary-button" onClick={() => save()}>오류 신고하기</button>
      </fieldset>}
    </details>
    <p className="feedback-status" role="status">{busy ? '저장 중…' : message}</p>{error && <p role="alert" className="error-message">{error}</p>}
  </section>;
}

export function PlayGame({ initialSession }: { initialSession: PlaySession }) {
  const [session, setSession] = useState(initialSession);
  const [cursor, setCursor] = useState(() => { const index = initialSession.questions.findIndex(q => !q.result); return index < 0 ? initialSession.questions.length : index; });
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusOnMove = useRef(false);
  const question = session.questions[cursor];
  useEffect(() => {
    if (focusOnMove.current) {
      heading.current?.focus();
      focusOnMove.current = false;
    }
  }, [cursor]);
  async function answer() {
    if (selected === null || !question || question.result || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      const data = await post(`/api/play/${session.id}/answer`, { position: question.position, answerIndex: selected });
      setSession(data.session);
      const graded: PlayQuestion | undefined = data.session.questions[cursor];
      if (graded?.result) setFeedback(graded.result.correct ? 'correct' : 'incorrect');
    } catch (caught) { setError(caught instanceof Error ? caught.message : '연결을 확인해 주세요.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  function move(index: number) { focusOnMove.current = true; setCursor(index); setSelected(null); setError(''); setFeedback(null); }
  if (!question) return <section className="preview-panel result-summary play-enter" aria-labelledby="result-title">
    <p className="eyebrow">오늘도 한 입 더 알아갔어요</p><h1 ref={heading} tabIndex={-1} id="result-title">{session.questions.length}문제 중 {session.score}문제 정답!</h1>
    <p className="intro-description">해설을 다시 읽거나 문제에 평가를 남겨보세요.</p>
    <ol className="result-list">{session.questions.map((q, i) => <li key={q.id}><button onClick={() => move(i)}><span className={q.result?.correct ? 'correct-text' : 'incorrect-text'}>{q.result?.correct ? '정답' : '오답'}</span><span>{q.question}</span><span aria-hidden="true">→</span></button></li>)}</ol>
    <div className="play-links"><Link className="primary-button button-link" href="/">다른 문제 풀기</Link><Link href="/play/history">풀이 기록 보기</Link></div>
  </section>;
  const result = question.result;
  return <section aria-labelledby="question-title">
    <div className="section-heading"><h2>상식 한 입</h2><span>{cursor + 1} / {session.questions.length}{question.isReview ? ' · 복습 문제' : ''}</span></div>
    <div className="play-progress" role="progressbar" aria-valuenow={session.questions.filter(q => q.result).length} aria-valuemin={0} aria-valuemax={session.questions.length} aria-label="풀이 진행률">
      <span style={{ transform: `scaleX(${session.questions.filter(q => q.result).length / session.questions.length})` }} />
    </div>
    <article key={question.id} className={`question-card play-card ${feedback ? `feedback-${feedback}` : 'play-enter'}`}>
      <p className="question-number">문제 {String(cursor + 1).padStart(2, '0')}</p><h3 ref={heading} tabIndex={-1} id="question-title">{question.question}</h3>
      <fieldset className="answer-options" disabled={busy || !!result}><legend className="visually-hidden">정답 하나 선택</legend>
        {question.options.map((option, i) => <label key={i} className={`answer-option ${result?.correctAnswerIndex === i ? 'answer-correct' : ''} ${result && result.selectedIndex === i && !result.correct ? 'answer-incorrect' : ''}`}>
          <input type="radio" name={`answer-${question.id}`} checked={(result?.selectedIndex ?? selected) === i} onChange={() => setSelected(i)} />
          <span>{option}</span>{result && result.correctAnswerIndex === i && <strong>정답</strong>}{result && !result.correct && result.selectedIndex === i && <strong>내 답</strong>}
        </label>)}
      </fieldset>
      {!result && <button className="primary-button answer-submit" disabled={busy || selected === null} onClick={answer}>{busy ? '답 확인 중…' : '정답 확인하기'}</button>}
      {error && <p role="alert" className="error-message">{error} <button className="text-button" onClick={() => window.location.reload()}>저장된 풀이 다시 불러오기</button></p>}
      {result && <>
        <div className={`answer-explanation ${result.correct ? 'explanation-correct' : 'explanation-incorrect'}`} role="status"><div className="answer-verdict"><span className="verdict-icon" aria-hidden="true">{result.correct ? '✓' : '↗'}</span><strong className={result.correct ? 'correct-text' : 'incorrect-text'}>{result.correct ? '맞았어요!' : '이번에 새로 알아가요.'}</strong></div><p>{result.explanation}</p>
          <ul className="source-list">{result.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a></li>)}</ul>
        </div>
        <QuestionFeedback key={question.id} question={question} onSave={rating => setSession(current => ({ ...current, questions: current.questions.map(q => q.id === question.id ? { ...q, ...(rating ? { rating } : { reported: true }) } : q) }))} />
        <div className="play-links"><button className="primary-button" onClick={() => move(cursor + 1)}>{cursor + 1 === session.questions.length ? '결과 보기' : '다음 문제'}</button>{session.completed && <button className="text-button" onClick={() => move(session.questions.length)}>전체 결과로</button>}</div>
      </>}
    </article>
  </section>;
}
