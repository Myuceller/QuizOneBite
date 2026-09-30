import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { requireUser } from "@/server/auth/session";
import { getQuizRepository } from "@/server/db/quiz-repository";
import { getQuizPreview } from "@/features/quiz/application/generate-quiz";
import { QuestionList } from "@/features/quiz/components/question-list";
import { categoryLabels, difficultyLabels } from "@/features/quiz/domain/labels";

export const metadata = { title: "저장한 문제 · 퀴즈퀴즈" };
export default async function HistoryDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const draft = await getQuizRepository(user.id).findById(id);
  if (!draft) notFound();
  return <main className="app-shell"><SiteHeader /><section className="intro">
    <Link className="back-link" href="/history">← 내 문제 모음</Link>
    <h1>{categoryLabels[draft.category]}, 다시 만나기.</h1><p className="intro-description">{difficultyLabels[draft.difficulty]} · {draft.questions.length}문제 · 읽기 전용</p>
  </section><QuestionList quiz={getQuizPreview(draft)} /><SiteFooter /></main>;
}
