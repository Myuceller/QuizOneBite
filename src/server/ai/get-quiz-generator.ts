import "server-only";

import type { QuizGenerator } from "../../features/quiz/ports/quiz-generator";
import { readAIConfig } from "../config/ai";
import { MockQuizGenerator } from "./mock-quiz-generator";
import { OpenAIQuizGenerator } from "./openai-quiz-generator";

export function getQuizGenerator(): QuizGenerator {
  const config = readAIConfig();
  return config.provider === "mock"
    ? new MockQuizGenerator()
    : new OpenAIQuizGenerator(config.apiKey, config.model);
}
