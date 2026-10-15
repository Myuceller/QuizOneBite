import { z } from 'zod';
import type { QuestionImage } from './question-image';
import { QUIZ_CATEGORIES, QUIZ_DIFFICULTIES } from '@/features/quiz/domain/quiz';

export const StartPlaySchema = z.object({
  requestId: z.uuid(),
  category: z.enum(['all', ...QUIZ_CATEGORIES]).default('all'),
  difficulty: z.enum(['all', ...QUIZ_DIFFICULTIES]).default('all'),
  count: z.number().int().min(1).max(10).default(5),
  mode: z.enum(['standard', 'endless']).optional(),
  source: z.enum(['standard', 'wrong', 'bookmarks', 'daily']).optional(),
  questionId: z.uuid().optional(),
}).strict().refine(v => !v.source || v.source === 'standard' || v.mode !== 'endless', '복습과 오늘의 문제는 일반 모드로 풀어요.').refine(v => !v.questionId || v.source === 'wrong' || v.source === 'bookmarks', '복습 목록의 문제만 지정할 수 있어요.');
export const BookmarkSchema = z.object({ saved: z.boolean() }).strict();
export type LearningSource = 'standard' | 'wrong' | 'bookmarks' | 'daily';
export const playSourceLabels: Record<LearningSource, string> = { standard: '상식 한 입', wrong: '오답 복습', bookmarks: '북마크 복습', daily: '오늘의 5문제' };
const PositionSchema = z.number().int().min(0).max(2147483646);
export const AnswerSchema = z.object({ position: PositionSchema, answerIndex: z.number().int().min(0).max(3) }).strict();
export const NextQuestionSchema = z.object({ position: PositionSchema }).strict();
export const FinishPlaySchema = z.object({}).strict();
export const RatingSchema = z.discriminatedUnion('value', [
  z.object({ value: z.literal(1), reason: z.null().optional() }).strict(),
  z.object({ value: z.literal(-1), reason: z.enum(['obvious', 'ambiguous', 'options']) }).strict(),
]);
export const ReportSchema = z.object({ reason: z.enum(['answer', 'explanation', 'ambiguous']) }).strict();
export type StartPlay = z.infer<typeof StartPlaySchema>;
export type Rating = z.infer<typeof RatingSchema>;
export type ReportReason = z.infer<typeof ReportSchema>['reason'];
export type Source = { title: string; url: string };
export type PlayQuestion = {
  id: string; position: number; question: string; options: string[]; isReview: boolean;
  image?: QuestionImage | null; rating: Rating | null; reported: boolean; bookmarked: boolean;
  result?: { selectedIndex: number; correctAnswerIndex: number; correct: boolean; explanation: string; sources: Source[] };
};
export type PlaySession = { id: string; category: string; difficulty: string; completed: boolean; score: number; questions: PlayQuestion[]; mode: 'standard' | 'endless'; answeredCount: number; source: LearningSource; dailyDay: string | null };
export type PlayHistory = { id: string; createdAt: string; count: number; answered: number; score: number; mode: 'standard' | 'endless'; completed: boolean; source: LearningSource; dailyDay: string | null };
export type LearningCollection = { total: number; page: number; items: { id: string; question: string; category: string; difficulty: string; image: QuestionImage | null; available: boolean }[] };
export type LearningDashboard = {
  categories: { category: string; answered: number; correct: number }[];
  wrongCount: number; bookmarkCount: number;
  daily: { day: string; sessionId: string | null; completed: boolean; answered: number; score: number };
  participation: { day: string; completed: boolean; score: number }[];
};
export class PlayError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
