import { BookmarkSchema } from '@/features/play/domain/play';
import { getPlayRepository } from '@/server/db/play-repository';
import { playBody, playId, playRequest } from '@/server/play-http';
export const runtime = 'nodejs';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return playRequest(request, 'feedback', async userId => {
    const body = await playBody(request, BookmarkSchema);
    await getPlayRepository().bookmark(userId, playId((await params).id), body.saved);
    return { saved: body.saved };
  });
}
