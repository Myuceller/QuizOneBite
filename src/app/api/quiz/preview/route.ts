import { getQuizPreview } from "@/features/quiz/application/generate-quiz";
import { createQuiz } from "@/features/quiz/application/create-quiz";
import { GenerationError } from "@/features/quiz/domain/errors";
import { QuizStorageError } from "@/features/quiz/domain/storage-error";
import { getQuizGenerator } from "@/server/ai/get-quiz-generator";
import { getQuizRepository } from "@/server/db/quiz-repository";
import { getAuth } from "@/server/auth";
import { consumePreviewQuota } from "@/server/db/quiz-history";

export const runtime = "nodejs";
export const maxDuration = 60;

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Production allows authenticated samples; paid AI remains a development-only preview. */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.AI_PROVIDER !== "mock") {
    return errorResponse("PREVIEW_DISABLED", "현재 샘플 문제만 이용할 수 있습니다.", 503);
  }

  // Only this app may trigger the local preview from a browser.
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  // Next.js can normalize request.url to localhost while Host remains 127.0.0.1.
  const expectedOrigin = process.env.BETTER_AUTH_URL || `${requestUrl.protocol}//${request.headers.get("host") ?? requestUrl.host}`;
  if (origin && origin !== expectedOrigin) {
    return errorResponse("INVALID_ORIGIN", "허용되지 않은 요청입니다.", 403);
  }

  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 2048) {
      return errorResponse("INVALID_INPUT", "요청이 너무 큽니다.", 413);
    }
    input = JSON.parse(body);
  } catch {
    return errorResponse("INVALID_INPUT", "올바른 JSON 요청이 필요합니다.", 400);
  }

  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session && process.env.NODE_ENV === "production") {
      return errorResponse("UNAUTHORIZED", "로그인하고 문제를 만나보세요.", 401);
    }
    if (session && !await consumePreviewQuota(session.user.id)) {
      return errorResponse("RATE_LIMITED", "문제를 너무 빠르게 요청했어요. 1분 후 다시 시도해 주세요.", 429);
    }
    const draft = await createQuiz(input, getQuizGenerator(), getQuizRepository(session?.user.id));
    return Response.json({ quiz: getQuizPreview(draft) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof QuizStorageError) return errorResponse(error.code, error.message, 503);
    if (error instanceof GenerationError) {
      const status = error.code === "INVALID_INPUT" ? 400 : error.code === "CONFIGURATION_ERROR" ? 503 : 502;
      return errorResponse(error.code, error.message, status);
    }
    return errorResponse("INTERNAL_ERROR", "문제를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
}
