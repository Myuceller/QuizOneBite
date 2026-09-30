import { describe, expect, it, vi } from "vitest";
import { GenerationError } from "../domain/errors";
import type { QuizGenerationResult, QuizGenerator } from "../ports/quiz-generator";
import { generateQuiz, getQuizPreview } from "./generate-quiz";

const request = { category: "science", difficulty: "easy", count: 2 } as const;

function result(count: number = request.count): QuizGenerationResult {
  return {
    quiz: {
      questions: Array.from({ length: count }, (_, index) => ({
        question: `테스트 문제 ${index + 1}`,
        options: ["첫째", "둘째", "셋째", "넷째"],
        correctAnswerIndex: 2,
        explanation: "테스트 해설입니다.",
      })),
    },
    metadata: {
      provider: "mock",
      model: "test-fixture",
      promptVersion: "quiz.v1",
      verificationStatus: "unreviewed",
    },
  };
}

function generatorFor(value: unknown): QuizGenerator {
  return { generate: vi.fn().mockResolvedValue(value) };
}

describe("generateQuiz", () => {
  it("validates a draft and supplies the default question count", async () => {
    const generator = generatorFor(result(3));
    const draft = await generateQuiz({ category: "science", difficulty: "easy" }, generator);

    expect(generator.generate).toHaveBeenCalledWith({ ...request, count: 3 });
    expect(draft.id).toMatch(/^[\da-f-]{36}$/);
    expect(draft.questions).toHaveLength(3);
    expect(draft.metadata.verificationStatus).toBe("unreviewed");
  });

  it.each([
    { ...request, category: "unknown" },
    { ...request, difficulty: "unknown" },
    { ...request, count: 0 },
    { ...request, count: 6 },
    { ...request, count: 1.5 },
    { ...request, count: "2" },
    null,
  ])("rejects invalid input before invoking the provider: %j", async (input) => {
    const generator = generatorFor(result());
    await expect(generateQuiz(input, generator)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it("rejects a count mismatch instead of silently returning fewer questions", async () => {
    await expect(generateQuiz(request, generatorFor(result(1)))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });

  it.each([
    { options: ["첫째", "둘째", "셋째"] },
    { options: ["첫째", " 첫째 ", "셋째", "넷째"] },
    { options: ["A  B", "a b", "셋째", "넷째"] },
    { options: ["첫째", " ", "셋째", "넷째"] },
    { correctAnswerIndex: 4 },
    { correctAnswerIndex: -1 },
    { correctAnswerIndex: 1.5 },
    { question: " " },
    { explanation: " " },
  ])("rejects invalid generated question data: %j", async (patch) => {
    const invalid = result();
    Object.assign(invalid.quiz.questions[0], patch);
    await expect(generateQuiz(request, generatorFor(invalid))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });

  it("rejects duplicate questions after normalizing whitespace", async () => {
    const invalid = result();
    invalid.quiz.questions[1].question = `  ${invalid.quiz.questions[0].question}  `;
    await expect(generateQuiz(request, generatorFor(invalid))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });

  it.each([null, {}, { quiz: null }, { ...result(), metadata: { verificationStatus: "verified" } }])(
    "rejects malformed provider results: %j",
    async (value) => {
      await expect(generateQuiz(request, generatorFor(value))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    },
  );

  it("replaces unexpected provider errors with a safe application error", async () => {
    const generator = { generate: vi.fn().mockRejectedValue(new Error("secret upstream response sk-test")) };
    await expect(generateQuiz(request, generator)).rejects.toEqual(
      new GenerationError("AI_UNAVAILABLE", "퀴즈를 생성하지 못했어요. 잠시 후 다시 시도해 주세요."),
    );
  });
});

describe("getQuizPreview", () => {
  it("allows only public fields and never sends answers or internal metadata", async () => {
    const draft = await generateQuiz(request, generatorFor(result()));
    const preview = getQuizPreview(draft);

    expect(preview).toEqual({
      id: draft.id,
      category: "science",
      difficulty: "easy",
      questions: draft.questions.map(({ id, question, options }) => ({ id, question, options })),
    });
    expect(JSON.stringify(preview)).not.toMatch(/correctAnswerIndex|explanation|metadata|promptVersion|verificationStatus/);
    preview.questions[0].options[0] = "changed";
    expect(draft.questions[0].options[0]).toBe("첫째");
  });
});
