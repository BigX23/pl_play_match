import { after } from "next/server";
import { withUser, jsonBody } from "@/server/route-helpers";
import { listMessages, sendMessage } from "@/server/data";
import { maybeReplyAsRally } from "@/server/rally";
import { pushNewMessage } from "@/server/push";
import { getDb } from "@/db";

export const GET = withUser(async (db, me, _req, params) => listMessages(db, me, params.id));

export const POST = withUser(async (db, me, req, params) => {
  const body = await jsonBody(req);
  const text = String(body.text ?? "");
  const msg = await sendMessage(db, me, params.id, text);
  // After the response: push to other participants, and let Rally reply if
  // addressed. `after` keeps the server working on these post-response.
  after(async () => {
    await pushNewMessage(getDb(), params.id, me, msg.senderName, text);
    await maybeReplyAsRally(getDb(), params.id, text);
  });
  return msg;
});
