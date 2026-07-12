/**
 * Next.js instrumentation hook — runs once at server boot.
 * Applies pending Drizzle SQL migrations when a database is configured.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) {
    console.warn("[PlayMatch] DATABASE_URL not set — skipping migrations (mock mode)");
    return;
  }
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    // Seed the Rally system user (sender of AI messages) idempotently.
    await client`
      INSERT INTO users (id, name, email, first_name, avatar, profile_complete, bio)
      VALUES ('rally', 'Rally', 'rally@playmatch.app', 'Rally', 'R', true,
              'Rally, the PlayMatch assistant')
      ON CONFLICT (id) DO NOTHING
    `;
    console.log("[PlayMatch] Database migrations applied");
  } finally {
    await client.end();
  }
}
