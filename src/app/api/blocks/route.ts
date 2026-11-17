import { withUser, jsonBody } from "@/server/route-helpers";
import { blockUser, listBlockedUsers } from "@/server/data";

/** Players I've blocked. */
export const GET = withUser(async (db, me) => listBlockedUsers(db, me));

/** Block a player (idempotent). Body: { userId }. */
export const POST = withUser(async (db, me, req) => {
  const body = await jsonBody(req);
  await blockUser(db, me, String(body.userId ?? ""));
});
