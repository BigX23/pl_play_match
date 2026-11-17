import { withUser, jsonBody } from "@/server/route-helpers";
import { parseNativePushToken, unregisterNativePushToken } from "@/server/data";

/** Forget one of the signed-in user's FCM tokens. Body: { token }. */
export const POST = withUser(async (db, me, req) => {
  const { token } = parseNativePushToken(await jsonBody(req), { requirePlatform: false });
  await unregisterNativePushToken(db, me, token);
});
