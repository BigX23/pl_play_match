import { withUser, jsonBody } from "@/server/route-helpers";
import { updateReportStatus } from "@/server/data";

/** Admin-only: set a report's status. Body: { status: "open"|"reviewed"|"actioned" }. */
export const PATCH = withUser(async (db, me, req, params) => {
  const body = await jsonBody(req);
  return updateReportStatus(db, me, params.id, String(body.status ?? ""));
});
