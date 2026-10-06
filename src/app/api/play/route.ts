import { StartPlaySchema } from '@/features/play/domain/play';
import { getPlayRepository } from '@/server/db/play-repository';
import { playBody, playRequest } from '@/server/play-http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return playRequest(request, 'start', async userId => ({ session: await getPlayRepository().start(userId, await playBody(request, StartPlaySchema)) }));
}
