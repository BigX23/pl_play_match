import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { appleCookieOverrides, appleWebProvider } from "@/server/auth-providers";

/**
 * Auth.js v5 — Google sign-in (plus Sign in with Apple once its env vars are
 * set, see src/server/auth-providers.ts) with database sessions in Postgres.
 * Google client ID/secret come from AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET (env on the VPS).
 * The iOS/Android apps sign in through /api/auth/native instead (same tables).
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const apple = appleWebProvider();
  return {
    adapter: DrizzleAdapter(getDb(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    providers: apple ? [Google, apple] : [Google],
    ...(apple ? { cookies: appleCookieOverrides() } : {}),
    trustHost: true, // behind Caddy
    pages: {
      signIn: "/login",
    },
    callbacks: {
      session({ session, user }) {
        // Expose the DB user id and onboarding state to the client session.
        session.user.id = user.id;
        session.user.profileComplete = (user as { profileComplete?: boolean }).profileComplete ?? false;
        return session;
      },
    },
  };
});
