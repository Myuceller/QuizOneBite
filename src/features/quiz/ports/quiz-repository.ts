import type { QuizDraft } from "../domain/quiz";

/** Immutable draft persistence. save inserts a new draft; existing IDs are never overwritten. */
export interface QuizRepository {
  save(quiz: QuizDraft): Promise<void>;
  findById(id: string): Promise<QuizDraft | null>;
}
