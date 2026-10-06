import { getPlayRepository } from '@/server/db/play-repository';
import { playId, playRequest } from '@/server/play-http';
export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return playRequest(request, 'read', async userId => ({ session: await getPlayRepository().get(userId, playId((await params).id)) }));
}
