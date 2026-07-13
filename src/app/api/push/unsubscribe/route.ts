import { withUser, jsonBody } from "@/server/route-helpers";
import { removePushSubscription } from "@/server/data";

export const POST = withUser(async (db, me, req) => {
  const body = await jsonBody(req);
  await removePushSubscription(db, me, String(body.endpoint ?? ""));
});
