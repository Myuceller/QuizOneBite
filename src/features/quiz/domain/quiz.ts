import { z } from "zod";

export const QUIZ_CATEGORIES = [
  "general",
  "science",
  "history",
  "geography",
  "culture",
] as const;

export const QUIZ_DIFFICULTIES = ["easy", "medium", "hard"] as const;

export const QuizGenerationInputSchema = z.object({
  category: z.enum(QUIZ_CATEGORIES),
  difficulty: z.enum(QUIZ_DIFFICULTIES),
  count: z.number().int().min(1).max(5).default(3),
});

const normalizedText = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

const QuestionSchema = z.object({
  question: z.string().trim().min(1).max(500),
  options: z
    .array(z.string().trim().min(1).max(200))
    .length(4)
    .refine((options) => new Set(options.map(normalizedText)).size === 4, {
      message: "Options must be distinct.",
    }),
  correctAnswerIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(1).max(1000),
});

export const GeneratedQuizSchema = z
  .object({ questions: z.array(QuestionSchema).min(1).max(5) })
  .refine(
    ({ questions }) =>
      new Set(questions.map(({ question }) => normalizedText(question))).size === questions.length,
    { message: "Questions must be distinct.", path: ["questions"] },
  );

export const QuizGenerationMetadataSchema = z.object({
  provider: z.enum(["mock", "openai"]),
  model: z.string().trim().min(1),
  promptVersion: z.string().trim().min(1),
  verificationStatus: z.literal("unreviewed"),
});

export type QuizGenerationInput = z.infer<typeof QuizGenerationInputSchema>;
export type QuizCategory = QuizGenerationInput["category"];
export type QuizDifficulty = QuizGenerationInput["difficulty"];
export type GeneratedQuiz = z.infer<typeof GeneratedQuizSchema>;
export type QuizGenerationMetadata = z.infer<typeof QuizGenerationMetadataSchema>;

export const QuizDraftSchema = z.object({
  id: z.uuid(),
  category: z.enum(QUIZ_CATEGORIES),
  difficulty: z.enum(QUIZ_DIFFICULTIES),
  questions: z.array(QuestionSchema.extend({ id: z.string().trim().min(1) })).min(1).max(5),
  metadata: QuizGenerationMetadataSchema,
}).refine(({ questions }) => GeneratedQuizSchema.safeParse({ questions }).success, {
  message: "Stored questions must satisfy the generation contract.",
});

export type QuizDraft = z.infer<typeof QuizDraftSchema>;

export type QuizPreview = {
  id: string;
  category: QuizCategory;
  difficulty: QuizDifficulty;
  questions: Array<{
    id: string;
    question: string;
    options: string[];
  }>;
};
