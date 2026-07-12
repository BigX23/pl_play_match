import { withUser } from "@/server/route-helpers";
import { markConversationRead } from "@/server/data";

export const POST = withUser(async (db, me, _req, params) => {
  await markConversationRead(db, me, params.id);
});
