import type { QuizGenerator } from "../ports/quiz-generator";
import type { QuizRepository } from "../ports/quiz-repository";
import { generateQuiz } from "./generate-quiz";

export async function createQuiz(input: unknown, generator: QuizGenerator, repository: QuizRepository) {
  const quiz = await generateQuiz(input, generator);
  await repository.save(quiz);
  return quiz;
}
