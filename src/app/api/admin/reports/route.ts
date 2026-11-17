import { withUser } from "@/server/route-helpers";
import { listReports } from "@/server/data";

/** Admin-only (ADMIN_EMAILS): reports, `?status=open|reviewed|actioned|all` (default open). */
export const GET = withUser(async (db, me, req) => {
  const status = new URL(req.url).searchParams.get("status") || "open";
  return listReports(db, me, status);
});
