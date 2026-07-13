import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/server/push";

/** Public VAPID key for the client's PushManager.subscribe (not secret). */
export function GET() {
  return NextResponse.json({ publicKey: vapidPublicKey() });
}
