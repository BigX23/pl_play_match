import { withUser } from "@/server/route-helpers";
import { getPlayer } from "@/server/data";

export const GET = withUser(async (db, me, _req, params) => getPlayer(db, params.id, me));
