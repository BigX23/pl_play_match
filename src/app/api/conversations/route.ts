import { withUser, jsonBody } from "@/server/route-helpers";
import { AuthzError, createDirectConversation, createGroupConversation, listConversations } from "@/server/data";

export const GET = withUser(async (db, me) => listConversations(db, me));

export const POST = withUser(async (db, me, req) => {
  const body = await jsonBody(req);
  if (body.type === "direct") {
    return createDirectConversation(db, me, String(body.otherUserId ?? ""));
  }
  if (body.type === "group") {
    const participantIds = Array.isArray(body.participantIds)
      ? body.participantIds.map(String)
      : [];
    return createGroupConversation(
      db,
      me,
      participantIds.includes(me) ? participantIds : [...participantIds, me],
      String(body.matchId ?? ""),
      String(body.name ?? "Match Chat"),
      String(body.rallyIntro ?? "")
    );
  }
  throw new AuthzError("unknown conversation type");
});
