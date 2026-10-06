import { getDatabasePool } from "@/server/db/pool";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await getDatabasePool().query("SELECT id FROM public.auth_user LIMIT 0");
    await getDatabasePool().query("SELECT owner_id FROM quizquiz.quizzes LIMIT 0");
    await getDatabasePool().query("SELECT question_id FROM quizquiz.question_ratings LIMIT 0");
    await getDatabasePool().query("SELECT session_id FROM quizquiz.play_items LIMIT 0");
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
