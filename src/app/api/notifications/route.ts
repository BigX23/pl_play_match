import { withUser } from "@/server/route-helpers";
import { listNotifications, clearNotifications } from "@/server/data";

export const GET = withUser(async (db, me) => listNotifications(db, me));

export const DELETE = withUser(async (db, me) => ({ deleted: await clearNotifications(db, me) }));
