import { z } from 'zod';
import { QUIZ_CATEGORIES, QUIZ_DIFFICULTIES } from '@/features/quiz/domain/quiz';

export const StartPlaySchema = z.object({
  requestId: z.uuid(),
  category: z.enum(['all', ...QUIZ_CATEGORIES]).default('all'),
  difficulty: z.enum(['all', ...QUIZ_DIFFICULTIES]).default('all'),
  count: z.number().int().min(1).max(10).default(5),
}).strict();
export const AnswerSchema = z.object({ position: z.number().int().min(0).max(9), answerIndex: z.number().int().min(0).max(3) }).strict();
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
  rating: Rating | null; reported: boolean;
  result?: { selectedIndex: number; correctAnswerIndex: number; correct: boolean; explanation: string; sources: Source[] };
};
export type PlaySession = { id: string; category: string; difficulty: string; completed: boolean; score: number; questions: PlayQuestion[] };
export type PlayHistory = { id: string; createdAt: string; count: number; answered: number; score: number };
export class PlayError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
