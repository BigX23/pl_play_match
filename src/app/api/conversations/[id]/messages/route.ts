import { withUser, jsonBody } from "@/server/route-helpers";
import { listMessages, sendMessage } from "@/server/data";

export const GET = withUser(async (db, me, _req, params) => listMessages(db, me, params.id));

export const POST = withUser(async (db, me, req, params) => {
  const body = await jsonBody(req);
  return sendMessage(db, me, params.id, String(body.text ?? ""));
});
