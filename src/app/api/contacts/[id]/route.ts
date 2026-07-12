import { withUser } from "@/server/route-helpers";
import { removeContact } from "@/server/data";

export const DELETE = withUser(async (db, me, _req, params) => {
  await removeContact(db, me, params.id);
});
