import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/auth";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/** Serve profile photos (signed-in users only). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { file } = await ctx.params;
  // Strict allow-list: "<uuid-ish>.<known ext>" — no separators, no traversal.
  if (!/^[A-Za-z0-9-]+\.(jpg|png|webp|gif)$/.test(file)) {
    return NextResponse.json({ error: "bad filename" }, { status: 400 });
  }
  try {
    const data = await readFile(path.join(UPLOAD_DIR, file));
    const ext = file.split(".").pop()!;
    return new NextResponse(data, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
