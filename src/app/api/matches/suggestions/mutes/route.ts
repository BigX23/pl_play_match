import { withUser, jsonBody } from "@/server/route-helpers";
import { listMutedSuggestions, muteSuggestion } from "@/server/data";

export const GET = withUser(async (db, me) => listMutedSuggestions(db, me));

export const POST = withUser(async (db, me, req) => {
  const body = await jsonBody(req);
  await muteSuggestion(db, me, String(body.userId ?? ""));
});
