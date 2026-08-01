import { withUser } from "@/server/route-helpers";
import { markNotificationRead, deleteNotification } from "@/server/data";

export const PATCH = withUser(async (db, me, _req, params) => {
  await markNotificationRead(db, me, params.id);
});

export const DELETE = withUser(async (db, me, _req, params) => {
  await deleteNotification(db, me, params.id);
});
