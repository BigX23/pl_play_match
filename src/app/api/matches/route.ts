import { withUser, jsonBody } from "@/server/route-helpers";
import { createMatch, listMatches } from "@/server/data";

export const GET = withUser(async (db, me, req) => {
  const mine = new URL(req.url).searchParams.get("mine") === "1";
  return listMatches(db, me, mine);
});

export const POST = withUser(async (db, me, req) => createMatch(db, me, await jsonBody(req)));
