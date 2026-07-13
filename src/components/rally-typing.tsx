"use client";

/**
 * "Rally is typing…" indicator, styled like a Rally message bubble with three
 * animated dots. Shown while Rally's server-side reply is being generated so
 * the user knows a response is on the way.
 */
export default function RallyTyping() {
  return (
    <div className="flex gap-2 mb-3 justify-start" role="status" aria-label="Rally is typing">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-accent">
        R
      </div>
      <div className="max-w-[75%]">
        <p className="text-xs mb-1 font-medium text-accent">Rally</p>
        <div className="rounded-2xl px-4 py-3 bg-accent/10 border border-accent/20 rounded-bl-md inline-flex items-center gap-1">
          <span className="sr-only">Rally is typing…</span>
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      aria-hidden="true"
      className="h-2 w-2 rounded-full bg-accent/70 animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}
