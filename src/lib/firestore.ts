/**
 * Legacy module path — the data layer moved to Postgres behind API routes.
 * Kept as a re-export so existing imports (`@/lib/firestore`) keep working.
 * New code should import from `@/lib/data`.
 */
export * from "./data";
