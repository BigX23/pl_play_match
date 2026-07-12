import { sseResponse } from "@/server/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Wakes when any of the signed-in user's conversations change. */
export function GET(req: Request) {
  return sseResponse(req, (me, payload) => !!payload.participants?.includes(me));
}
