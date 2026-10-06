import { AnswerSchema } from '@/features/play/domain/play';
import { getPlayRepository } from '@/server/db/play-repository';
import { playBody, playId, playRequest } from '@/server/play-http';
export const runtime = 'nodejs';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return playRequest(request, 'answer', async userId => {
    const body = await playBody(request, AnswerSchema);
    return { session: await getPlayRepository().answer(userId, playId((await params).id), body.position, body.answerIndex) };
  });
}
