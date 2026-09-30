import type {
  GeneratedQuiz,
  QuizGenerationInput,
  QuizGenerationMetadata,
} from "../domain/quiz";

export type QuizGenerationResult = {
  quiz: GeneratedQuiz;
  metadata: QuizGenerationMetadata;
};

export interface QuizGenerator {
  generate(input: QuizGenerationInput): Promise<QuizGenerationResult>;
}
