import { after } from "next/server";
import { withUser, jsonBody } from "@/server/route-helpers";
import { createMatchRequest, listMatchRequests, getPlayer } from "@/server/data";
import { pushMatchRequest } from "@/server/push";
import { getDb } from "@/db";

export const GET = withUser(async (db, me) => listMatchRequests(db, me));

export const POST = withUser(async (db, me, req) => {
  const body = await jsonBody(req);
  const toUserId = String(body.toUserId ?? "");
  const score = Number(body.score ?? 0);
  const request = await createMatchRequest(db, me, toUserId, score);
  after(async () => {
    const from = await getPlayer(getDb(), me).catch(() => null);
    await pushMatchRequest(getDb(), toUserId, from?.firstName || from?.name || "Someone", score);
  });
  return request;
});
