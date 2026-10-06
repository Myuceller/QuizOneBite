import { notFound } from 'next/navigation';
import { z } from 'zod';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { requireUser } from '@/server/auth/session';
import { getPlayRepository } from '@/server/db/play-repository';
import { PlayError } from '@/features/play/domain/play';
import { PlayGame } from '@/features/play/components/play-game';

export const metadata = { title: '상식 한 입 · 퀴즈퀴즈' };
export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const session = await getPlayRepository().get(user.id, id).catch(error => { if (error instanceof PlayError && error.status === 404) notFound(); throw error; });
  return <main className="app-shell"><SiteHeader /><div className="play-section"><PlayGame initialSession={session} /></div><SiteFooter /></main>;
}
