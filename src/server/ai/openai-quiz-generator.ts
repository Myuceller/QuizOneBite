import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { GenerationError } from "../../features/quiz/domain/errors";
import { GeneratedQuizSchema, type QuizGenerationInput } from "../../features/quiz/domain/quiz";
import type { QuizGenerator } from "../../features/quiz/ports/quiz-generator";
import { buildQuizPrompt, QUIZ_INSTRUCTIONS, QUIZ_PROMPT_VERSION } from "./quiz-prompt";

// Keep the remote JSON schema plain; enforce local refinements after parsing.
const RemoteQuizSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      correctAnswerIndex: z.number().int(),
      explanation: z.string(),
    }),
  ),
});

export class OpenAIQuizGenerator implements QuizGenerator {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new OpenAI({ apiKey, timeout: 20_000, maxRetries: 0 });
  }

  async generate(input: QuizGenerationInput) {
    try {
      const response = await this.client.responses.parse({
        model: this.model,
        instructions: QUIZ_INSTRUCTIONS,
        input: buildQuizPrompt(input),
        reasoning: { effort: "low" },
        max_output_tokens: 4000,
        store: false,
        text: { format: zodTextFormat(RemoteQuizSchema, "quiz") },
      });

      const refused = response.output.some(
        (item) => item.type === "message" && item.content.some((part) => part.type === "refusal"),
      );
      const quiz = GeneratedQuizSchema.safeParse(response.output_parsed);
      if (response.status !== "completed" || refused || !quiz.success || quiz.data.questions.length !== input.count) {
        throw new GenerationError("INVALID_OUTPUT", "생성된 퀴즈 형식이 올바르지 않아요. 다시 시도해 주세요.");
      }

      return {
        quiz: quiz.data,
        metadata: {
          provider: "openai" as const,
          model: this.model,
          promptVersion: QUIZ_PROMPT_VERSION,
          verificationStatus: "unreviewed" as const,
        },
      };
    } catch (error) {
      if (error instanceof GenerationError) throw error;
      throw new GenerationError("AI_UNAVAILABLE", "퀴즈를 생성하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }
}
