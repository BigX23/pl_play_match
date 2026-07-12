import { withUser } from "@/server/route-helpers";
import { markNotificationRead } from "@/server/data";

export const PATCH = withUser(async (db, me, _req, params) => {
  await markNotificationRead(db, me, params.id);
});
