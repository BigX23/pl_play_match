import { withUser } from "@/server/route-helpers";
import { joinOpenMatch } from "@/server/data";

export const POST = withUser(async (db, me, _req, params) => ({
  joined: await joinOpenMatch(db, me, params.id),
}));
