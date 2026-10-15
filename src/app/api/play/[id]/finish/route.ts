import { FinishPlaySchema } from '@/features/play/domain/play';
import { getPlayRepository } from '@/server/db/play-repository';
import { playBody, playId, playRequest } from '@/server/play-http';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return playRequest(request, 'next', async userId => {
    await playBody(request, FinishPlaySchema);
    return { session: await getPlayRepository().finish(userId, playId((await params).id)) };
  });
}
