import { withUser } from "@/server/route-helpers";
import { getMatchSuggestions } from "@/server/data";

export const GET = withUser(async (db, me) => getMatchSuggestions(db, me));
