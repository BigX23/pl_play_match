import { withUser } from "@/server/route-helpers";
import { unblockUser } from "@/server/data";

/** Lift a block I placed (idempotent). */
export const DELETE = withUser(async (db, me, _req, params) => {
  await unblockUser(db, me, params.id);
});
