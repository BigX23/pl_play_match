import { withUser, jsonBody } from "@/server/route-helpers";
import { addContact, listContacts } from "@/server/data";

export const GET = withUser(async (db, me) => listContacts(db, me));

export const POST = withUser(async (db, me, req) => {
  const body = await jsonBody(req);
  await addContact(db, me, {
    id: String(body.id ?? ""),
    name: body.name ? String(body.name) : undefined,
    email: body.email ? String(body.email) : undefined,
    avatar: body.avatar ? String(body.avatar) : undefined,
  });
});
