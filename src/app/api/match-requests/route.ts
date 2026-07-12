import { withUser, jsonBody } from "@/server/route-helpers";
import { createMatchRequest, listMatchRequests } from "@/server/data";

export const GET = withUser(async (db, me) => listMatchRequests(db, me));

export const POST = withUser(async (db, me, req) => {
  const body = await jsonBody(req);
  return createMatchRequest(db, me, String(body.toUserId ?? ""), Number(body.score ?? 0));
});
