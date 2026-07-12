import { withUser } from "@/server/route-helpers";
import { deleteConversation, getConversation } from "@/server/data";

export const GET = withUser(async (db, me, _req, params) => getConversation(db, me, params.id));

export const DELETE = withUser(async (db, me, _req, params) => {
  await deleteConversation(db, me, params.id);
});
