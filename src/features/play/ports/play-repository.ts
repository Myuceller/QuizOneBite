import type { PlayHistory, PlaySession, Rating, ReportReason, StartPlay } from '../domain/play';

export interface PlayRepository {
  start(userId: string, input: StartPlay): Promise<PlaySession>;
  get(userId: string, id: string): Promise<PlaySession>;
  answer(userId: string, id: string, position: number, answerIndex: number): Promise<PlaySession>;
  rate(userId: string, questionId: string, rating: Rating): Promise<void>;
  report(userId: string, questionId: string, reason: ReportReason): Promise<void>;
  history(userId: string): Promise<PlayHistory[]>;
}
