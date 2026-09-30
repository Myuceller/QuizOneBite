import { describe, expect, it } from "vitest";
import { readAIConfig } from "./ai";

describe("readAIConfig", () => {
  it("defaults to mock without reading or requiring an API key", () => {
    expect(readAIConfig({})).toEqual({ provider: "mock" });
    expect(readAIConfig({ AI_PROVIDER: "mock", OPENAI_API_KEY: "unused" })).toEqual({ provider: "mock" });
  });

  it("requires a key only when the OpenAI provider is selected", () => {
    expect(() => readAIConfig({ AI_PROVIDER: "openai" })).toThrowError("서버 AI 연결 설정이 필요해요.");
    expect(() => readAIConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "  " })).toThrowError("서버 AI 연결 설정이 필요해요.");
  });

  it("defaults the OpenAI model to Astra and permits a configured model", () => {
    expect(readAIConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: " test-key " })).toEqual({
      provider: "openai", apiKey: "test-key", model: "gpt-6-astra",
    });
    expect(readAIConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "test-key", OPENAI_MODEL: "custom-model" })).toEqual({
      provider: "openai", apiKey: "test-key", model: "custom-model",
    });
  });

  it.each(["", "typo", "OPENAI", " mock "])("rejects an explicit invalid provider %j", (provider) => {
    expect(() => readAIConfig({ AI_PROVIDER: provider })).toThrowError("AI 제공자 설정을 확인해 주세요.");
  });
});
