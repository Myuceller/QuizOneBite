import { getAuth } from "@/server/auth";

export const runtime = "nodejs";
async function handle(request: Request) {
  try {
    return await getAuth().handler(request);
  } catch {
    return Response.json({ code: "AUTH_UNAVAILABLE", message: "인증 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
export { handle as GET, handle as POST };
