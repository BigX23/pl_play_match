import { withUser, jsonBody } from "@/server/route-helpers";
import { parseNativePushToken, registerNativePushToken } from "@/server/data";

/** Store the iOS/Android app's FCM token for the signed-in user. Body: { token, platform: "ios" | "android" }. */
export const POST = withUser(async (db, me, req) => {
  const { token, platform } = parseNativePushToken(await jsonBody(req), { requirePlatform: true });
  await registerNativePushToken(db, me, token, platform);
});
