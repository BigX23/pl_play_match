import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

/**
 * Auth.js v5 — Google-only sign-in with database sessions in Postgres.
 * Client ID/secret come from AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET (env on the VPS).
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [Google],
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
}));
