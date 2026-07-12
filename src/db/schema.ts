import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type {
  DayAvailability,
  GameType,
  MatchFormat,
  PartnerPreferences,
  SportType,
} from "@/lib/matching-engine";

/**
 * Phase 2 schema: Auth.js tables + the app's user profile.
 * The rest of the domain (matches, conversations, …) lands in Phase 3.
 */

// ---------- users (Auth.js base + PlayMatch profile) ----------
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // Auth.js base fields
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),

  // PlayMatch profile
  firstName: text("first_name"),
  lastName: text("last_name"),
  age: integer("age"),
  gender: text("gender"),
  avatar: text("avatar"),
  photoUrl: text("photo_url"),
  ntrpRating: real("ntrp_rating"),
  sport: text("sport"), // legacy single-sport field
  sports: jsonb("sports").$type<SportType[]>(),
  matchFormats: jsonb("match_formats").$type<MatchFormat[]>(),
  gameType: text("game_type").$type<GameType>(),
  weeklyAvailability: jsonb("weekly_availability").$type<DayAvailability[]>(),
  partnerPreferences: jsonb("partner_preferences").$type<PartnerPreferences>(),
  profileComplete: boolean("profile_complete").notNull().default(false),
  matchesPlayed: integer("matches_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  bio: text("bio"),
  aboutMe: text("about_me"),
  location: text("location"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ---------- Auth.js adapter tables ----------
export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

export type DbUser = typeof users.$inferSelect;
