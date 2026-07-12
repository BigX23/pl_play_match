import { withUser } from "@/server/route-helpers";
import { listNotifications } from "@/server/data";

export const GET = withUser(async (db, me) => listNotifications(db, me));
