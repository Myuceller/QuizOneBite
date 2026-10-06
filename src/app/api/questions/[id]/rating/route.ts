import { RatingSchema } from '@/features/play/domain/play';
import { getPlayRepository } from '@/server/db/play-repository';
import { playBody, playId, playRequest } from '@/server/play-http';
export const runtime = 'nodejs';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return playRequest(request, 'feedback', async userId => {
    await getPlayRepository().rate(userId, playId((await params).id), await playBody(request, RatingSchema));
    return { saved: true };
  });
}
