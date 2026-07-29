import { auth } from "@/auth";
import { onChange, type ChangePayload } from "./realtime";

/**
 * Server-Sent Events stream gated by the session. Emits a lightweight "change"
 * event whenever `shouldWake` matches a NOTIFY payload; the client re-fetches
 * through the normal authorized API. A heartbeat keeps the connection alive
 * and everything is torn down on disconnect.
 *
 * Teardown is deliberately defensive. Next.js (standalone) does not reliably
 * fire `req.signal` "abort" when a browser drops an SSE connection, so we also:
 *   1. cap each stream to MAX_STREAM_MS — the client's EventSource reconnects
 *      seamlessly (we send `retry: 3000`), and
 *   2. tear down when the outbound queue backs up (a dead socket that stopped
 *      draining).
 * Without this, a disconnected client leaks a bus listener AND buffers every
 * enqueue forever — which is exactly how the app crept to ~2.4 GB / 4 pegged
 * cores over days of traffic.
 */
const HEARTBEAT_MS = 25_000;
const MAX_STREAM_MS = 5 * 60_000;
const MAX_QUEUED = 12; // enqueues buffered without the socket draining ⇒ dead

export async function sseResponse(
  req: Request,
  shouldWake: (me: string, payload: ChangePayload) => boolean,
  opts?: { onOpen?: (me: string) => Promise<void> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("unauthenticated", { status: 401 });
  }
  const me = session.user.id;

  // Authorization check (e.g. participant of the conversation) before streaming.
  if (opts?.onOpen) {
    try {
      await opts.onOpen(me);
    } catch {
      return new Response("forbidden", { status: 403 });
    }
  }

  const encoder = new TextEncoder();
  let unsub = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let lifespan: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsub();
        if (heartbeat) clearInterval(heartbeat);
        if (lifespan) clearTimeout(lifespan);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        // Dead/stalled consumer: the queue backs up because the socket isn't
        // draining. Tear down instead of buffering forever.
        if (controller.desiredSize !== null && controller.desiredSize < -MAX_QUEUED) {
          cleanup();
          return;
        }
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      // Reconnect quickly if dropped; nudge the client to do its first fetch.
      safeEnqueue("retry: 3000\n\n");
      safeEnqueue("event: ping\ndata: connected\n\n");

      unsub = onChange((payload) => {
        if (shouldWake(me, payload)) safeEnqueue("event: change\ndata: 1\n\n");
      });

      heartbeat = setInterval(() => safeEnqueue(": hb\n\n"), HEARTBEAT_MS);
      // Hard lifetime cap: guarantees teardown even if `abort` never fires.
      lifespan = setTimeout(cleanup, MAX_STREAM_MS);

      // Tear down when the client disconnects.
      req.signal.addEventListener("abort", cleanup);
      if (req.signal.aborted) cleanup();
    },
    cancel() {
      closed = true;
      unsub();
      if (heartbeat) clearInterval(heartbeat);
      if (lifespan) clearTimeout(lifespan);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
