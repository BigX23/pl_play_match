import { withUser } from "@/server/route-helpers";
import { unmuteSuggestion } from "@/server/data";

export const DELETE = withUser(async (db, me, _req, params) => {
  await unmuteSuggestion(db, me, params.id);
});
