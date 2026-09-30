import { beforeEach, describe, expect, it, vi } from "vitest";

const { parse, createClient } = vi.hoisted(() => ({ parse: vi.fn(), createClient: vi.fn() }));

vi.mock("openai", () => ({
  default: class {
    responses = { parse };
    constructor(options: unknown) {
      createClient(options);
    }
  },
}));

import { OpenAIQuizGenerator } from "./openai-quiz-generator";

const input = { category: "science", difficulty: "easy", count: 1 } as const;
const quiz = {
  questions: [{
    question: "물의 화학식은 무엇인가요?",
    options: ["H₂O", "CO₂", "O₂", "NaCl"],
    correctAnswerIndex: 0,
    explanation: "물은 수소와 산소로 이루어집니다.",
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  parse.mockResolvedValue({ status: "completed", output: [], output_parsed: quiz });
});

describe("OpenAIQuizGenerator", () => {
  it("uses bounded Responses structured output with no storage or automatic retries", async () => {
    const generator = new OpenAIQuizGenerator("test-key", "gpt-6-astra");
    const result = await generator.generate(input);

    expect(createClient).toHaveBeenCalledWith({ apiKey: "test-key", timeout: 20_000, maxRetries: 0 });
    expect(parse).toHaveBeenCalledOnce();
    const request = parse.mock.calls[0][0];
    expect(request).toMatchObject({
      model: "gpt-6-astra",
      reasoning: { effort: "low" },
      store: false,
      max_output_tokens: 4000,
      text: { format: { type: "json_schema", name: "quiz", strict: true } },
    });
    expect(JSON.parse(request.input)).toEqual(input);
    expect(request).not.toHaveProperty("temperature");
    expect(result).toEqual({
      quiz,
      metadata: { provider: "openai", model: "gpt-6-astra", promptVersion: "quiz.v1", verificationStatus: "unreviewed" },
    });
  });

  it.each(["incomplete", "failed", "cancelled", "in_progress", undefined])(
    "rejects status %j even if a partial parsed response appears valid",
    async (status) => {
      parse.mockResolvedValue({ status, output: [], output_parsed: quiz });
      await expect(new OpenAIQuizGenerator("test-key", "gpt-6-astra").generate(input)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    },
  );

  it("rejects a refusal even alongside parsed data", async () => {
    parse.mockResolvedValue({
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal", refusal: "upstream text" }] }],
      output_parsed: quiz,
    });
    await expect(new OpenAIQuizGenerator("test-key", "gpt-6-astra").generate(input)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });

  it.each([null, {}, { questions: [] }, { questions: [{ ...quiz.questions[0], options: ["A", "A", "B", "C"] }] }])(
    "rejects invalid remote content: %j",
    async (output) => {
      parse.mockResolvedValue({ status: "completed", output: [], output_parsed: output });
      await expect(new OpenAIQuizGenerator("test-key", "gpt-6-astra").generate(input)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    },
  );

  it("sanitizes SDK and transport errors without attaching their cause", async () => {
    parse.mockRejectedValue(new Error("Sensitive response: test-key, billing details, raw prompt"));
    const error = await new OpenAIQuizGenerator("test-key", "gpt-6-astra").generate(input).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "AI_UNAVAILABLE", message: "퀴즈를 생성하지 못했어요. 잠시 후 다시 시도해 주세요." });
    expect(error).not.toHaveProperty("cause");
    expect(JSON.stringify(error)).not.toMatch(/test-key|billing|raw prompt/);
  });
});
