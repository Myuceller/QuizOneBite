import { z } from 'zod';
import { QUIZ_SUBCATEGORIES } from '../../quiz/domain/taxonomy.ts';
import { QUIZ_DIFFICULTIES, GeneratedQuizSchema } from '../../quiz/domain/quiz.ts';

export const SubmissionSchema = z.object({
  requestId: z.uuid(),
  subcategory: z.string().refine(id => QUIZ_SUBCATEGORIES.some(s => s.id === id), '소분류를 선택해 주세요.'),
  difficulty: z.enum(QUIZ_DIFFICULTIES),
  question: z.string().trim().min(10).max(500),
  options: z.array(z.string().trim().min(1).max(200)).length(4),
  correctAnswerIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(10).max(1000),
  sourceTitle: z.string().trim().min(1).max(200),
  sourceUrl: z.url().max(2000).refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  }, 'HTTPS 출처 주소를 입력해 주세요.'),
}).strict().refine(value => GeneratedQuizSchema.safeParse({ questions: [value] }).success, '서로 다른 보기 네 개를 입력해 주세요.');
export type SubmissionInput = z.infer<typeof SubmissionSchema>;
export type SubmissionSummary = { id: string; question: string; subcategory: string; difficulty: string; status: 'pending' | 'approved' | 'rejected'; createdAt: string; reviewNote: string | null };
export class SubmissionError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) { super(message); this.code = code; this.status = status; }
}
