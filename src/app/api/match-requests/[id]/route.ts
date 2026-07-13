import { after } from "next/server";
import { withUser, jsonBody } from "@/server/route-helpers";
import { updateMatchRequest, getPlayer } from "@/server/data";
import { pushMatchAccepted } from "@/server/push";
import { getDb } from "@/db";

export const PATCH = withUser(async (db, me, req, params) => {
  const body = await jsonBody(req);
  const status = body.status ? String(body.status) : undefined;
  const conversationId = body.conversationId !== undefined ? String(body.conversationId) : undefined;
  const updated = await updateMatchRequest(db, me, params.id, { status, conversationId });

  if (status === "accepted") {
    after(async () => {
      const by = await getPlayer(getDb(), me).catch(() => null);
      await pushMatchAccepted(
        getDb(),
        updated.fromUserId,
        by?.firstName || by?.name || "Someone",
        updated.conversationId ?? undefined
      );
    });
  }
  return updated;
});
