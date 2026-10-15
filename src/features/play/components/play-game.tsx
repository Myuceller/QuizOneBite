'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BusyIndicator } from '@/components/busy-indicator';
import { Celebration } from '@/components/celebration';
import { BookmarkButton, StartLearningButton } from './learning-actions';
import { QuestionIllustration } from './question-illustration';
import { playSourceLabels } from '../domain/play';
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
  const saving = useRef(false);
  async function save(next?: Rating) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true); setError(''); setMessage('');
    try {
      await post(`/api/questions/${question.id}/${next ? 'rating' : 'report'}`, next ?? { reason: reportReason });
      onSave(next);
      if (next) { setRating(next); setMessage('평가를 저장했어요. 나중에 바꿀 수도 있어요.'); }
      else { setReported(true); setMessage('오류 신고를 접수했어요. 다시 확인할게요.'); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : '연결을 확인해 주세요.'); }
    finally { saving.current = false; setBusy(false); }
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
    <p className="feedback-status" role="status">{busy ? <><BusyIndicator />저장 중…</> : message && <span key={message} className="feedback-saved"><span aria-hidden="true">✓ </span>{message}</span>}</p>{error && <p role="alert" className="error-message">{error}</p>}
  </section>;
}

export function PlayGame({ initialSession }: { initialSession: PlaySession }) {
  const [session, setSession] = useState(initialSession);
  const [cursor, setCursor] = useState(() => { const index = initialSession.questions.findIndex(q => !q.result); return index < 0 ? initialSession.mode === 'endless' && !initialSession.completed ? Math.max(0, initialSession.questions.length - 1) : initialSession.questions.length : index; });
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusOnMove = useRef(false);
  const question = session.questions[cursor];
  const endless = session.mode === 'endless';
  const total = endless ? session.answeredCount : session.questions.length;
  useEffect(() => {
    if (focusOnMove.current) {
      heading.current?.focus();
      focusOnMove.current = false;
    }
  }, [cursor, question?.position]);
  async function answer() {
    if (selected === null || !question || question.result || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      const data = await post(`/api/play/${session.id}/answer`, { position: question.position, answerIndex: selected });
      const next: PlaySession = data.session;
      setSession(next);
      const index = next.questions.findIndex(q => q.position === question.position);
      setCursor(index < 0 ? next.completed ? next.questions.length : next.questions.length - 1 : index);
      setSelected(null);
      const graded = next.questions[index];
      if (graded?.result) setFeedback(graded.result.correct ? 'correct' : 'incorrect');
    } catch (caught) { setError(caught instanceof Error ? caught.message : '연결을 확인해 주세요.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function advance(action: 'next' | 'finish') {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const data = await post(`/api/play/${session.id}/${action}`, action === 'next' ? { position: question.position } : {});
      const next: PlaySession = data.session;
      setSession(next);
      move(next.completed ? next.questions.length : next.questions.length - 1);
    } catch (caught) { setError(caught instanceof Error ? caught.message : '연결을 확인해 주세요.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  function move(index: number) { focusOnMove.current = true; setCursor(index); setSelected(null); setError(''); setFeedback(null); }
  if (!question) return <section className="preview-panel result-summary play-enter" aria-labelledby="result-title">
    <Celebration />
    <div className="completion-badge"><span aria-hidden="true">✦</span> {endless ? '무한모드 완료!' : `${playSourceLabels[session.source]} 완료!`}</div>
    <div className="score-medallion" aria-hidden="true">
      <svg viewBox="0 0 100 100"><circle className="score-track" cx="50" cy="50" r="42" /><circle className="score-fill" cx="50" cy="50" r="42" pathLength="100" style={{ '--score-gap': 100 - (total ? session.score / total * 100 : 0) } as CSSProperties} /></svg>
      <span><strong>{session.score}</strong><small>/ {total}</small></span>
    </div>
    <p className="eyebrow">오늘도 한 입 더 알아갔어요</p><h1 ref={heading} tabIndex={-1} id="result-title">{total}문제 중 {session.score}문제 정답!</h1>
    <p className="intro-description">{endless ? '누적 점수는 모두 저장됐어요. 최근 20문제의 해설을 다시 볼 수 있어요.' : '해설을 다시 읽거나 문제에 평가를 남겨보세요.'}</p>
    <ol className="result-list">{session.questions.map((q, i) => <li key={q.position} style={{ '--item-delay': `${i * 45}ms` } as CSSProperties}><button onClick={() => move(i)}><span className={q.result?.correct ? 'correct-text' : 'incorrect-text'}>{q.result?.correct ? '정답' : '오답'}</span><span>{q.question}<QuestionIllustration key={q.image?.src} image={q.image} compact /></span><span className="button-arrow" aria-hidden="true">→</span></button></li>)}</ol>
    <div className="play-links">{session.score < total && <StartLearningButton source="wrong">틀린 문제 다시 풀기</StartLearningButton>}<Link href="/play/learning">분야별 내 성적</Link><Link className="primary-button button-link" href="/">다른 문제 풀기</Link><Link href="/play/history">풀이 기록 보기</Link></div>
  </section>;
  const result = question.result;
  return <section aria-labelledby="question-title">
    <div className="section-heading"><h2>{endless ? '무한모드' : playSourceLabels[session.source]}</h2><span className="question-counter" key={question.position}><strong>{question.position + 1}</strong>{endless ? '번째 문제' : ` / ${session.questions.length}`}{question.isReview ? ' · 복습 문제' : ''}</span></div>
    {session.dailyDay && <p className="bank-note">{session.dailyDay} · 오늘의 공통 문제</p>}
    {endless && <div className="endless-status"><p role="status">{session.answeredCount}문제 풀이 · {session.score}개 정답{session.answeredCount > 0 ? ` · 정답률 ${Math.round(session.score / session.answeredCount * 100)}%` : ''}</p>{!session.completed && <button className="secondary-button" disabled={busy} onClick={() => advance('finish')}>여기까지 마치기</button>}</div>}
    {!endless && <><div className="play-progress" role="progressbar" aria-valuenow={session.questions.filter(q => q.result).length} aria-valuemin={0} aria-valuemax={session.questions.length} aria-label="풀이 진행률">
      <span style={{ transform: `scaleX(${session.questions.filter(q => q.result).length / session.questions.length})` }} />
    </div>
    <ol className="play-steps" aria-label="문제별 진행 상태">{session.questions.map((q, i) => <li key={q.position} className={q.result ? q.result.correct ? 'step-correct' : 'step-incorrect' : ''} aria-current={i === cursor ? 'step' : undefined}><span aria-hidden="true">{q.result ? q.result.correct ? '✓' : '−' : i + 1}</span><span className="visually-hidden">문제 {i + 1}: {q.result ? q.result.correct ? '정답' : '오답' : '아직 풀지 않음'}</span></li>)}</ol></>}
    <article key={question.position} className={`question-card play-card ${feedback ? `feedback-${feedback}` : 'play-enter'}`}>
      {feedback === 'correct' && <Celebration />}
      <p className="question-number">문제 {String(question.position + 1).padStart(2, '0')}</p><h3 ref={heading} tabIndex={-1} id="question-title">{question.question}</h3>
      <QuestionIllustration key={question.image?.src} image={question.image} />
      <fieldset className="answer-options" disabled={busy || !!result}><legend className="visually-hidden">정답 하나 선택</legend>
        {question.options.map((option, i) => <label key={i} className={`answer-option ${result?.correctAnswerIndex === i ? 'answer-correct' : ''} ${result && result.selectedIndex === i && !result.correct ? 'answer-incorrect' : ''}`}>
          <input className="visually-hidden" type="radio" name={`answer-${question.id}`} checked={(result?.selectedIndex ?? selected) === i} onChange={() => setSelected(i)} />
          <span className="answer-marker" aria-hidden="true">{result ? result.correctAnswerIndex === i ? '✓' : result.selectedIndex === i ? '−' : i + 1 : selected === i ? '✓' : i + 1}</span>
          <span>{option}</span>{result && result.correctAnswerIndex === i && <strong>정답</strong>}{result && !result.correct && result.selectedIndex === i && <strong>내 답</strong>}
        </label>)}
      </fieldset>
      {!result && <div className="answer-actions"><p className="selection-hint" role="status"><span key={selected}>{selected === null ? '마음이 가는 답을 골라보세요.' : `${selected + 1}번을 골랐어요. 정답을 확인해볼까요?`}</span></p><button className="primary-button answer-submit" disabled={busy || selected === null} aria-busy={busy} onClick={answer}>{busy ? <><BusyIndicator />답 확인 중…</> : <>정답 확인하기 <span className="button-arrow" aria-hidden="true">→</span></>}</button></div>}
      {error && <p role="alert" className="error-message">{error} <button className="text-button" onClick={() => window.location.reload()}>저장된 풀이 다시 불러오기</button></p>}
      {result && <>
        <div className={`answer-explanation ${result.correct ? 'explanation-correct' : 'explanation-incorrect'}`} role="status"><div className="answer-verdict"><span className="verdict-decoration"><span className="verdict-icon" aria-hidden="true">{result.correct ? '✓' : '↗'}</span>{feedback === 'correct' && <span className="success-burst" aria-hidden="true">{[0,1,2,3,4,5].map(n => <i key={n} style={{ '--burst-angle': `${n * 60}deg` } as CSSProperties} />)}</span>}</span><strong className={result.correct ? 'correct-text' : 'incorrect-text'}>{result.correct ? '맞았어요!' : '이번에 새로 알아가요.'}</strong></div><p>{result.explanation}</p>
          <ul className="source-list">{result.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a></li>)}</ul>
        </div>
        <div className="play-links"><BookmarkButton key={question.position} questionId={question.id} saved={question.bookmarked} onSave={bookmarked => setSession(current => ({ ...current, questions: current.questions.map(q => q.id === question.id ? { ...q, bookmarked } : q) }))} /><Link href="/play/collection?source=bookmarks">북마크 모음</Link></div>
        <QuestionFeedback key={question.position} question={question} onSave={rating => setSession(current => ({ ...current, questions: current.questions.map(q => q.id === question.id ? { ...q, ...(rating ? { rating } : { reported: true }) } : q) }))} />
        <div className="play-links"><button className="primary-button" disabled={busy} aria-busy={busy} onClick={() => endless && !session.completed && cursor + 1 === session.questions.length ? advance('next') : move(cursor + 1)}>{busy ? <><BusyIndicator />처리 중…</> : <>{cursor + 1 === session.questions.length && (!endless || session.completed) ? '결과 보기' : '다음 문제'}<span className="button-arrow" aria-hidden="true">→</span></>}</button>{session.completed && <button className="text-button" onClick={() => move(session.questions.length)}>전체 결과로</button>}</div>
      </>}
    </article>
  </section>;
}
