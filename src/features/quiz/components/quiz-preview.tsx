"use client";

import { useState, type FormEvent } from "react";
import type { QuizPreview as QuizPreviewData } from "@/features/quiz/domain/quiz";
import Link from "next/link";
import { QuestionList } from "./question-list";

const categories = [
  { value: "general", label: "일반 상식" },
  { value: "science", label: "과학" },
  { value: "history", label: "역사" },
  { value: "geography", label: "지리" },
  { value: "culture", label: "문화" },
] as const;

const difficulties = [
  { value: "easy", label: "쉬움" },
  { value: "medium", label: "보통" },
  { value: "hard", label: "어려움" },
] as const;

type PreviewResponse = {
  quiz?: QuizPreviewData;
  error?: { code: string; message: string };
};

export function QuizPreview({ signedIn = false, requiresLogin = false }: { signedIn?: boolean; requiresLogin?: boolean }) {
  const [category, setCategory] = useState<string>("general");
  const [difficulty, setDifficulty] = useState<string>("easy");
  const [quiz, setQuiz] = useState<QuizPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setQuiz(null);

    try {
      const response = await fetch("/api/quiz/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, difficulty, count: 3 }),
      });
      const result = (await response.json()) as PreviewResponse;

      if (!response.ok || !result.quiz) {
        throw new Error(result.error?.message ?? "문제를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      }

      setQuiz(result.quiz);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="preview-section" aria-labelledby="preview-title">
      <div className="section-heading">
        <h2 id="preview-title">문제 미리보기</h2>
        <span className="muted-text">3문제 · 읽기 전용</span>
      </div>

      <div className="preview-panel">
        <p className="sample-notice" id="sample-notice">
          준비된 샘플 문제를 만나보세요. 지금은 문제와 보기를 살펴볼 수 있어요.
          {signedIn ? " 만든 문제는 내 문제 모음에 자동으로 저장돼요." : " 로그인하면 문제 모음을 저장할 수 있어요."}
        </p>

        <form onSubmit={handlePreview} aria-describedby="sample-notice">
          <fieldset className="form-fields" disabled={loading}>
            <legend className="visually-hidden">퀴즈 미리보기 설정</legend>
            <label className="field">
              <span>주제</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>난이도</span>
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                {difficulties.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            {requiresLogin && !signedIn ? <Link className="primary-button button-link" href="/login">로그인하고 시작하기</Link> : <button className="primary-button" type="submit">
              {loading ? "문제 불러오는 중…" : "문제 미리보기"}
            </button>}
          </fieldset>
        </form>
      </div>

      <div className="preview-results" aria-busy={loading}>
        <p className="visually-hidden" role="status">
          {loading ? "미리보기 문제를 불러오고 있습니다." : quiz ? `${quiz.questions.length}개의 미리보기 문제가 준비되었습니다.` : ""}
        </p>

        {error && <p className="error-message" role="alert">{error}</p>}

        {!quiz && !error && (
          <div className="empty-state">
            <span className="empty-symbol" aria-hidden="true">?</span>
            <p>{loading ? "문제를 준비하고 있어요." : "어떤 주제가 궁금하세요?"}</p>
            <span>{loading ? "잠시만 기다려 주세요." : "주제와 난이도를 고르면 여기에 문제가 나타나요."}</span>
          </div>
        )}

        {quiz && (
          <><QuestionList quiz={quiz} />{signedIn && <p className="saved-notice" role="status">내 문제 모음에 저장했어요. <Link href={`/history/${quiz.id}`}>다시 보기 →</Link></p>}</>
        )}
      </div>
    </section>
  );
}
