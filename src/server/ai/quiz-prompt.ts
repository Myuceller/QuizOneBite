import type { QuizGenerationInput } from "../../features/quiz/domain/quiz";

export const QUIZ_PROMPT_VERSION = "quiz.v1";

export const QUIZ_INSTRUCTIONS = `당신은 한국어 상식 퀴즈의 초안을 작성합니다.
입력 JSON의 category, difficulty, count 설정을 따르세요.
category: general=일반 상식, science=과학, history=역사, geography=지리, culture=문화.
difficulty: easy=기초, medium=보통, hard=심화.
요청한 개수만큼 서로 다른 문제를 작성하세요. 각 문제에는 겹치지 않는 보기 4개와 유일한 정답이 있어야 합니다.
correctAnswerIndex는 0부터 3까지의 정답 보기 위치이며, 정답 위치가 한 곳에 몰리지 않게 하세요.
explanation은 정답을 설명하는 간결한 한국어 문장으로 작성하세요.
시간이 지나도 바뀌지 않는 널리 확립된 사실을 사용하세요. 시사, 논쟁적인 주장, 주관적 평가와 모호한 질문은 피하세요.
근거를 확신할 수 없는 내용이나 출처를 만들어 내지 마세요. 이 출력은 검수가 필요한 초안입니다.`;

export function buildQuizPrompt(input: QuizGenerationInput): string {
  return JSON.stringify(input);
}
