import { z } from 'zod';

// Only reviewed, immutable assets shipped with the app; never arbitrary remote URLs.
export const QuestionImageSchema = z.object({
  src: z.string().regex(/^\/quiz-images\/[a-f0-9]{32}\.svg$/),
  alt: z.string().trim().min(1).max(500),
  width: z.number().int().min(1).max(4000),
  height: z.number().int().min(1).max(4000),
}).strict();
export type QuestionImage = z.infer<typeof QuestionImageSchema>;
