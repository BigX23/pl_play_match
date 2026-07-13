import { after } from "next/server";
import { withUser, jsonBody } from "@/server/route-helpers";
import { listMessages, sendMessage } from "@/server/data";
import { maybeReplyAsRally } from "@/server/rally";
import { getDb } from "@/db";

export const GET = withUser(async (db, me, _req, params) => listMessages(db, me, params.id));

export const POST = withUser(async (db, me, req, params) => {
  const body = await jsonBody(req);
  const text = String(body.text ?? "");
  const msg = await sendMessage(db, me, params.id, text);
  // Rally replies after the response is sent; `after` keeps the server working
  // on it so the reply lands (via SSE) without delaying the sender's request.
  after(() => maybeReplyAsRally(getDb(), params.id, text));
  return msg;
});
