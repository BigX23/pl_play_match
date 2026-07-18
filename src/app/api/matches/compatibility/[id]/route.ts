import { withUser } from "@/server/route-helpers";
import { getCompatibility } from "@/server/data";

// Full compatibility breakdown between the signed-in user and player [id].
export const GET = withUser(async (db, me, _req, params) => getCompatibility(db, me, params.id));
