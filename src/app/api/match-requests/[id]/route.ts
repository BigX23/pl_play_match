import { withUser, jsonBody } from "@/server/route-helpers";
import { updateMatchRequest } from "@/server/data";

export const PATCH = withUser(async (db, me, req, params) => {
  const body = await jsonBody(req);
  return updateMatchRequest(db, me, params.id, {
    status: body.status ? String(body.status) : undefined,
    conversationId: body.conversationId !== undefined ? String(body.conversationId) : undefined,
  });
});
