import { after } from "next/server";
import { withUser, jsonBody } from "@/server/route-helpers";
import { createReport } from "@/server/data";
import { sendPushToUser } from "@/server/push";
import { getDb } from "@/db";

/**
 * File a report. Body: { reportedUserId?, messageId?, context?, reason, details? }.
 * Admins (ADMIN_EMAILS) get an in-app notification; a push follows after the
 * response.
 */
export const POST = withUser(async (db, me, req) => {
  const body = await jsonBody(req);
  const { report, adminIds } = await createReport(db, me, {
    reportedUserId: body.reportedUserId ? String(body.reportedUserId) : undefined,
    messageId: body.messageId ? String(body.messageId) : undefined,
    context: body.context ? String(body.context) : undefined,
    reason: String(body.reason ?? ""),
    details: body.details ? String(body.details) : undefined,
  });
  if (adminIds.length) {
    after(async () => {
      await Promise.all(
        adminIds.map((uid) =>
          sendPushToUser(getDb(), uid, {
            title: "New report 🚩",
            body: "A user report needs review.",
            url: "/dashboard/admin/reports",
          }).catch(() => {})
        )
      );
    });
  }
  return report;
});
