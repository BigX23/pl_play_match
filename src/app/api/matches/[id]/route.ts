import { withUser, jsonBody } from "@/server/route-helpers";
import { deleteMatch, updateMatch } from "@/server/data";

export const PATCH = withUser(async (db, me, req, params) =>
  updateMatch(db, me, params.id, await jsonBody(req))
);

export const DELETE = withUser(async (db, me, _req, params) => {
  await deleteMatch(db, me, params.id);
});
