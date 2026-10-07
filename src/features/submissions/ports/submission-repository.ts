import type { SubmissionInput, SubmissionSummary } from '../domain/submission';
export interface SubmissionRepository {
  submit(userId: string, input: SubmissionInput): Promise<SubmissionSummary>;
  history(userId: string): Promise<SubmissionSummary[]>;
}
