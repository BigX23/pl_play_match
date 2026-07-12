import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Upload the signed-in user's profile photo (multipart form, field "file"). */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  const ext = EXT[file.type];
  if (!ext) {
    return NextResponse.json({ error: "unsupported image type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "image too large (max 5 MB)" }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${session.user.id}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));

  const photoUrl = `/api/photos/${filename}?v=${Date.now()}`;
  await getDb().update(users).set({ photoUrl }).where(eq(users.id, session.user.id));
  return NextResponse.json({ photoURL: photoUrl });
}
