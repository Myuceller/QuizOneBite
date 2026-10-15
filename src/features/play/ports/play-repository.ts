import type { LearningCollection, LearningDashboard, PlayHistory, PlaySession, Rating, ReportReason, StartPlay } from '../domain/play';

export interface PlayRepository {
  start(userId: string, input: StartPlay): Promise<PlaySession>;
  get(userId: string, id: string): Promise<PlaySession>;
  answer(userId: string, id: string, position: number, answerIndex: number): Promise<PlaySession>;
  next(userId: string, id: string, position: number): Promise<PlaySession>;
  finish(userId: string, id: string): Promise<PlaySession>;
  rate(userId: string, questionId: string, rating: Rating): Promise<void>;
  report(userId: string, questionId: string, reason: ReportReason): Promise<void>;
  bookmark(userId: string, questionId: string, saved: boolean): Promise<void>;
  dashboard(userId: string): Promise<LearningDashboard>;
  collection(userId: string, source: 'wrong' | 'bookmarks', page: number): Promise<LearningCollection>;
  history(userId: string): Promise<PlayHistory[]>;
}
