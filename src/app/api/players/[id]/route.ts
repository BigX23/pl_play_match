import { withUser } from "@/server/route-helpers";
import { getPlayer } from "@/server/data";

export const GET = withUser(async (db, _me, _req, params) => getPlayer(db, params.id));
