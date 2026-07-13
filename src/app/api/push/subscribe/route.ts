import { withUser, jsonBody } from "@/server/route-helpers";
import { addPushSubscription, AuthzError } from "@/server/data";

export const POST = withUser(async (db, me, req) => {
  const body = await jsonBody(req);
  const endpoint = String(body.endpoint ?? "");
  const keys = (body.keys ?? {}) as { p256dh?: string; auth?: string };
  if (!endpoint || !keys.p256dh || !keys.auth) {
    throw new AuthzError("invalid subscription");
  }
  await addPushSubscription(db, me, { endpoint, p256dh: keys.p256dh, auth: keys.auth });
});
