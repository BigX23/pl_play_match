import { getDb } from "@/db";
import { handleNativeSignIn, nativeAuthConfig } from "@/server/native-auth";

/**
 * Native-app sign-in: the iOS/Android app POSTs a Google/Apple ID token and gets
 * a normal Auth.js database session cookie back. See src/server/native-auth.ts.
 * GET returns the public (non-secret) client IDs the app needs to start the native SDKs.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Lazy, so validation/rate-limit failures don't need a DB connection.
  return handleNativeSignIn(req, {
    get db() {
      return getDb();
    },
  });
}

export async function GET() {
  return Response.json(nativeAuthConfig(), { headers: { "Cache-Control": "no-store" } });
}
