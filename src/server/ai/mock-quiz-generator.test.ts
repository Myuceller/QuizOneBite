import { describe, expect, it } from "vitest";
import { generateQuiz } from "../../features/quiz/application/generate-quiz";
import { QUIZ_CATEGORIES, QUIZ_DIFFICULTIES } from "../../features/quiz/domain/quiz";
import { MockQuizGenerator } from "./mock-quiz-generator";

describe("MockQuizGenerator", () => {
  it.each(
    QUIZ_CATEGORIES.flatMap((category) => QUIZ_DIFFICULTIES.map((difficulty) => ({ category, difficulty }))),
  )("has valid fixtures for every allowed count in $category / $difficulty", async ({ category, difficulty }) => {
    const generator = new MockQuizGenerator();
    for (const count of [1, 2, 3, 4, 5]) {
      const draft = await generateQuiz({ category, difficulty, count }, generator);
      expect(draft.questions).toHaveLength(count);
      expect(draft).toMatchObject({ category, difficulty, metadata: { provider: "mock", verificationStatus: "unreviewed" } });
    }
  });

  it("uses different questions for different requested difficulty levels", async () => {
    const generator = new MockQuizGenerator();
    const easy = await generator.generate({ category: "science", difficulty: "easy", count: 5 });
    const hard = await generator.generate({ category: "science", difficulty: "hard", count: 5 });
    expect(easy.quiz.questions.map(({ question }) => question)).not.toEqual(hard.quiz.questions.map(({ question }) => question));
  });
});
