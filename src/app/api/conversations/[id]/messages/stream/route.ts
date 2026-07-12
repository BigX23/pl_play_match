import { sseResponse } from "@/server/sse";
import { getConversation } from "@/server/data";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Streams message changes for one conversation (participant-gated). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return sseResponse(
    req,
    (_me, payload) => payload.conversationId === id,
    { onOpen: async (me) => { await getConversation(getDb(), me, id); } }
  );
}
