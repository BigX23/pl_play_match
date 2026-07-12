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

// ---------- domain tables (Phase 3) ----------

export const matches = pgTable("matches", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  player1Id: text("player1_id").notNull().references(() => users.id),
  player2Id: text("player2_id"),
  date: text("date").notNull().default(""),
  time: text("time").notNull().default(""),
  location: text("location").notNull().default(""),
  sport: text("sport").notNull().default("tennis"),
  status: text("status").notNull().default("open"),
  score: text("score"),
  compatibilityScore: integer("compatibility_score").notNull().default(0),
  matchExplanation: text("match_explanation").notNull().default(""),
  matchType: text("match_type"),
  notes: text("notes"),
  createdBy: text("created_by"),
  acceptedBy: text("accepted_by"),
  conversationId: text("conversation_id"),
  cancelledBy: text("cancelled_by"),
  cancelReason: text("cancel_reason"),
  participants: jsonb("participants").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const matchRequests = pgTable("match_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  fromUserId: text("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toUserId: text("to_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  score: integer("score").notNull().default(0),
  conversationId: text("conversation_id"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull().default("direct"),
  name: text("name"),
  matchId: text("match_id"),
  createdBy: text("created_by"),
  lastMessage: text("last_message").notNull().default(""),
  lastMessageAt: timestamp("last_message_at", { mode: "date" }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    unreadCount: integer("unread_count").notNull().default(0),
    lastReadAt: timestamp("last_read_at", { mode: "date" }),
  },
  (cp) => [primaryKey({ columns: [cp.conversationId, cp.userId] })]
);

export const messages = pgTable("messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => users.id),
  senderName: text("sender_name").notNull().default(""),
  text: text("text").notNull(),
  isAi: boolean("is_ai").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const contacts = pgTable(
  "contacts",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    email: text("email"),
    avatar: text("avatar"),
    addedAt: timestamp("added_at", { mode: "date" }).notNull().defaultNow(),
  },
  (c) => [primaryKey({ columns: [c.userId, c.contactId] })]
);

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  read: boolean("read").notNull().default(false),
  link: text("link"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// Phase 6 (web push) — created now so the schema migrates once.
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type DbUser = typeof users.$inferSelect;
export type DbMatch = typeof matches.$inferSelect;
export type DbConversation = typeof conversations.$inferSelect;
export type DbMessage = typeof messages.$inferSelect;
