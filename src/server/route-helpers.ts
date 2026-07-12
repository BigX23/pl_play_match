import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { AuthzError, NotFoundError } from "./data";

type Db = ReturnType<typeof getDb>;

/**
 * Wrap a route handler with session resolution + error mapping.
 * The handler receives (db, sessionUserId, request, routeParams).
 */
export function withUser(
  handler: (db: Db, me: string, req: Request, params: Record<string, string>) => Promise<unknown>
) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    try {
      const params = ctx?.params ? await ctx.params : {};
      const result = await handler(getDb(), session.user.id, req, params);
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof AuthzError) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
      if (err instanceof NotFoundError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      console.error("[api] unhandled error:", err);
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
  };
}

export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
