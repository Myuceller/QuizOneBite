import "server-only";

import { GenerationError } from "../../features/quiz/domain/errors";

export type AIConfig =
  | { provider: "mock" }
  | { provider: "openai"; apiKey: string; model: string };

/** Read only when needed so a mock build never needs API credentials. */
export function readAIConfig(env: Readonly<Record<string, string | undefined>> = process.env): AIConfig {
  const provider = env.AI_PROVIDER ?? "mock";
  if (provider === "mock") return { provider };

  if (provider !== "openai") {
    throw new GenerationError("CONFIGURATION_ERROR", "AI 제공자 설정을 확인해 주세요.");
  }

  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new GenerationError("CONFIGURATION_ERROR", "서버 AI 연결 설정이 필요해요.");
  }

  const model = env.OPENAI_MODEL?.trim() || "gpt-6-astra";
  return { provider, apiKey, model };
}
