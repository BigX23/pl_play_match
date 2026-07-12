import { auth } from "@/auth";
import { onChange, type ChangePayload } from "./realtime";

/**
 * Server-Sent Events stream gated by the session. Emits a lightweight "change"
 * event whenever `shouldWake` matches a NOTIFY payload; the client re-fetches
 * through the normal authorized API. A heartbeat keeps the connection alive
 * and everything is torn down on disconnect.
 */
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
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsub();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Reconnect quickly if dropped; nudge the client to do its first fetch.
      safeEnqueue("retry: 3000\n\n");
      safeEnqueue("event: ping\ndata: connected\n\n");

      unsub = onChange((payload) => {
        if (shouldWake(me, payload)) safeEnqueue("event: change\ndata: 1\n\n");
      });

      heartbeat = setInterval(() => safeEnqueue(": hb\n\n"), 25000);

      // Tear down when the client disconnects.
      req.signal.addEventListener("abort", cleanup);
      if (req.signal.aborted) cleanup();
    },
    cancel() {
      closed = true;
      unsub();
      if (heartbeat) clearInterval(heartbeat);
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
