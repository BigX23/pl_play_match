import { withUser } from "@/server/route-helpers";
import { lookupPlayerByEmail, NotFoundError } from "@/server/data";

export const GET = withUser(async (db, me, req) => {
  const email = new URL(req.url).searchParams.get("email");
  if (!email) throw new NotFoundError("email required");
  return lookupPlayerByEmail(db, email, me);
});
