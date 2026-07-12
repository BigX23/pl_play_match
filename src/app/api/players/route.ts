import { withUser } from "@/server/route-helpers";
import { listPlayers } from "@/server/data";

export const GET = withUser(async (db) => listPlayers(db));
