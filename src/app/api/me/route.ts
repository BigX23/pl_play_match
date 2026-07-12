import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users, type DbUser } from "@/db/schema";

/**
 * The signed-in user's profile.
 * GET  → full profile row (shaped like the app's Player type)
 * PATCH → update own profile fields (allow-listed)
 */

function toPlayer(u: DbUser) {
  return {
    id: u.id,
    name: u.name ?? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim(),
    email: u.email ?? "",
    firstName: u.firstName ?? undefined,
    lastName: u.lastName ?? undefined,
    age: u.age ?? undefined,
    gender: u.gender ?? undefined,
    avatar: u.avatar ?? u.image ?? "",
    photoURL: u.photoUrl ?? undefined,
    ntrpRating: u.ntrpRating ?? 0,
    sport: (u.sport as "tennis" | "pickleball" | "both") ?? "both",
    sports: u.sports ?? undefined,
    matchFormats: u.matchFormats ?? undefined,
    gameType: u.gameType ?? undefined,
    weeklyAvailability: u.weeklyAvailability ?? undefined,
    partnerPreferences: u.partnerPreferences ?? undefined,
    profileComplete: u.profileComplete,
    matchesPlayed: u.matchesPlayed,
    wins: u.wins,
    losses: u.losses,
    bio: u.bio ?? "",
    aboutMe: u.aboutMe ?? undefined,
    location: u.location ?? "",
    availability: [] as string[], // legacy field, unused post-migration
    preferredTimes: [] as string[],
    joinedDate: u.createdAt.toISOString(),
  };
}

// Fields a user may set on their own profile.
const PATCHABLE = new Set([
  "name",
  "firstName",
  "lastName",
  "age",
  "gender",
  "avatar",
  "photoUrl",
  "photoURL",
  "ntrpRating",
  "sport",
  "sports",
  "matchFormats",
  "gameType",
  "weeklyAvailability",
  "partnerPreferences",
  "profileComplete",
  "bio",
  "aboutMe",
  "location",
]);

// Map client field names → DB column names where they differ.
const FIELD_MAP: Record<string, string> = { photoURL: "photoUrl" };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(toPlayer(row));
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const db = getDb();
  // Cascades to accounts + sessions via FK onDelete.
  await db.delete(users).where(eq(users.id, session.user.id));
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!PATCHABLE.has(key)) continue;
    update[FIELD_MAP[key] ?? key] = value;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no valid fields" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .update(users)
    .set(update)
    .where(eq(users.id, session.user.id))
    .returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(toPlayer(row));
}
