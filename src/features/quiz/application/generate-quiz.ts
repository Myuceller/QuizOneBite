import { GenerationError } from "../domain/errors";
import {
  GeneratedQuizSchema,
  QuizGenerationInputSchema,
  QuizGenerationMetadataSchema,
  type QuizDraft,
  type QuizPreview,
} from "../domain/quiz";
import type { QuizGenerator } from "../ports/quiz-generator";

export async function generateQuiz(input: unknown, generator: QuizGenerator): Promise<QuizDraft> {
  const request = QuizGenerationInputSchema.safeParse(input);
  if (!request.success) {
    throw new GenerationError("INVALID_INPUT", "퀴즈 생성 설정을 확인해 주세요.");
  }

  let result;
  try {
    result = await generator.generate(request.data);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("AI_UNAVAILABLE", "퀴즈를 생성하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }

  const quiz = GeneratedQuizSchema.safeParse(result?.quiz);
  const metadata = QuizGenerationMetadataSchema.safeParse(result?.metadata);
  if (!quiz.success || !metadata.success || quiz.data.questions.length !== request.data.count) {
    throw new GenerationError("INVALID_OUTPUT", "생성된 퀴즈 형식이 올바르지 않아요. 다시 시도해 주세요.");
  }

  return {
    id: crypto.randomUUID(),
    category: request.data.category,
    difficulty: request.data.difficulty,
    questions: quiz.data.questions.map((question, index) => ({
      id: `question-${index + 1}`,
      ...question,
    })),
    metadata: metadata.data,
  };
}

/** Explicit allowlist: answers, explanations, and provider metadata stay server-side. */
export function getQuizPreview(quiz: QuizDraft): QuizPreview {
  return {
    id: quiz.id,
    category: quiz.category,
    difficulty: quiz.difficulty,
    questions: quiz.questions.map(({ id, question, options }) => ({
      id,
      question,
      options: [...options],
    })),
  };
}
