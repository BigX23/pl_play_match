import { EventEmitter } from "events";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import type { getDb } from "@/db";

/**
 * Realtime fan-out over Postgres LISTEN/NOTIFY.
 *
 * ONE dedicated LISTEN connection re-emits every change through a process-local
 * EventEmitter, so N concurrent SSE clients share a single DB connection
 * instead of opening one each. Mutations call `notifyChange` to broadcast.
 *
 * Payload is intentionally tiny (ids only) — SSE handlers use it to decide
 * whether to wake a given client, which then re-fetches through the normal
 * authorized API. Nothing sensitive travels over NOTIFY.
 */

const CHANNEL = "playmatch";

export interface ChangePayload {
  /** Which conversation changed (message sent, read, created, deleted). */
  conversationId?: string;
  /** Users whose conversation list / unread is affected. */
  participants?: string[];
}

type Emitter = EventEmitter & { _pgListen?: postgres.Sql };

// Survive Next dev/HMR by stashing the singleton on globalThis.
const g = globalThis as unknown as { __playmatchBus?: Emitter };

function bus(): Emitter {
  if (g.__playmatchBus) return g.__playmatchBus;
  const em = new EventEmitter() as Emitter;
  em.setMaxListeners(0); // many concurrent SSE clients
  g.__playmatchBus = em;

  const url = process.env.DATABASE_URL;
  if (url) {
    // Dedicated single connection for LISTEN.
    const sql = postgres(url, { max: 1 });
    em._pgListen = sql;
    sql
      .listen(CHANNEL, (payload) => {
        try {
          em.emit("change", JSON.parse(payload) as ChangePayload);
        } catch {
          /* ignore malformed payloads */
        }
      })
      .catch((err) => console.error("[realtime] LISTEN failed:", err));
  }
  return em;
}

/** Broadcast a change through the pooled connection (called from mutations). */
export async function notifyChange(
  db: ReturnType<typeof getDb>,
  payload: ChangePayload
): Promise<void> {
  try {
    await db.execute(sql`select pg_notify(${CHANNEL}, ${JSON.stringify(payload)})`);
  } catch (err) {
    console.error("[realtime] NOTIFY failed:", err);
  }
}

/** Subscribe to change events. Returns an unsubscribe function. */
export function onChange(handler: (p: ChangePayload) => void): () => void {
  const em = bus();
  em.on("change", handler);
  return () => em.off("change", handler);
}
