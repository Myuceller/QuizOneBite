import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/quiz/preview/route";
import { QuizStorageError } from "@/features/quiz/domain/storage-error";

const { save, getSession, consumeQuota, repository } = vi.hoisted(() => ({ save: vi.fn(), getSession: vi.fn(), consumeQuota: vi.fn(), repository: vi.fn() }));
vi.mock("@/server/auth", () => ({ getAuth: () => ({ api: { getSession } }) }));
vi.mock("@/server/db/quiz-history", () => ({ consumePreviewQuota: consumeQuota }));
vi.mock("@/server/db/quiz-repository", () => ({
  getQuizRepository: repository,
}));

function request(body: string, origin?: string) {
  return new Request("http://localhost:3000/api/quiz/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}) },
    body,
  });
}

describe("development preview API", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_PROVIDER", "mock");
    save.mockReset().mockResolvedValue(undefined);
    getSession.mockReset().mockResolvedValue(null);
    consumeQuota.mockReset().mockResolvedValue(true);
    repository.mockReset().mockReturnValue({ save });
    vi.stubEnv("BETTER_AUTH_URL", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns a playable question shape without answers or internal metadata", async () => {
    const response = await POST(request(JSON.stringify({ category: "science", difficulty: "easy", count: 3 })));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const { quiz } = await response.json();
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0].id).toBe(quiz.id);
    expect(save.mock.calls[0][0].questions[0]).toHaveProperty("correctAnswerIndex");
    expect(quiz.questions).toHaveLength(3);
    expect(quiz).not.toHaveProperty("metadata");
    for (const question of quiz.questions) {
      expect(question.options).toHaveLength(4);
      expect(question).not.toHaveProperty("correctAnswerIndex");
      expect(question).not.toHaveProperty("explanation");
    }
  });

  it("rejects malformed JSON and excessive question counts", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ category: "science", difficulty: "easy", count: 6 })))).status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects cross-origin browser requests", async () => {
    expect((await POST(request("{}", "https://example.com"))).status).toBe(403);
  });

  it("accepts the browser host when Next.js normalizes the internal request URL", async () => {
    const input = request(JSON.stringify({ category: "science", difficulty: "easy", count: 1 }), "http://127.0.0.1:3000");
    input.headers.set("host", "127.0.0.1:3000");
    expect((await POST(input)).status).toBe(200);
  });

  it("keeps the unauthenticated preview disabled in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await POST(request("{}"))).status).toBe(503);
    expect(save).not.toHaveBeenCalled();
  });

  it("does not report success when saving the generated draft fails", async () => {
    save.mockRejectedValueOnce(new QuizStorageError("DATABASE_UNAVAILABLE"));
    const response = await POST(request(JSON.stringify({ category: "general", difficulty: "easy" })));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(body).not.toHaveProperty("quiz");
  });

  it("requires a session for production samples", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await POST(request('{}'))).status).toBe(401);
    expect(save).not.toHaveBeenCalled();
  });

  it("binds production samples to the server session, ignoring a supplied owner", async () => {
    vi.stubEnv("NODE_ENV", "production");
    getSession.mockResolvedValue({ user: { id: "real-user" } });
    const response = await POST(request(JSON.stringify({ category: "science", difficulty: "medium", count: 2, ownerId: "another-user" })));
    expect(response.status).toBe(200);
    expect(repository).toHaveBeenCalledWith("real-user");
    expect(consumeQuota).toHaveBeenCalledWith("real-user");
  });

  it("does not generate or save after the shared quota is exhausted", async () => {
    getSession.mockResolvedValue({ user: { id: "real-user" } });
    consumeQuota.mockResolvedValue(false);
    expect((await POST(request('{}'))).status).toBe(429);
    expect(save).not.toHaveBeenCalled();
  });
});
